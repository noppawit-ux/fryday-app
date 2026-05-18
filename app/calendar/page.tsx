"use client";

import { useEffect, useState, useCallback } from "react";

// ---- Types ----
interface CalendarItem {
  id: string;
  title: string;
  date: string;
  type: "task" | "event" | "marketing";
  status?: string;
  priority?: string;
  assignee?: string | null;
  category?: string;
  channel?: string;
}

// ---- สี/ไอคอนแต่ละประเภท ----
const TYPE_STYLE = {
  task:      { bg: "#E6F1FB", color: "#185FA5", border: "#B5D4F4", icon: "📋", label: "งาน" },
  event:     { bg: "#EAF3DE", color: "#27500A", border: "#C0DD97", icon: "📅", label: "กิจกรรม" },
  marketing: { bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6", icon: "📣", label: "Marketing" },
};

const PRIORITY_COLOR: Record<string, string> = {
  ด่วนมาก: "#D85A30", ปานกลาง: "#CB8A1A", ไม่เร่งด่วน: "#1D9E75",
};

const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  // pad start
  for (let i = 0; i < first.getDay(); i++) {
    const d = new Date(year, month, 1 - (first.getDay() - i));
    days.push(d);
  }
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  // pad end to fill 6 rows
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1);
    days.push(d);
  }
  return days;
}

// ---- Fetch helpers ----
async function fetchTasks(): Promise<CalendarItem[]> {
  try {
    const res = await fetch("/api/tasks?done=false");
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.tasks ?? []).filter((t: any) => t.deadline).map((t: any) => ({
      id: t.id,
      title: t.name,
      date: t.deadline,
      type: "task" as const,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee,
      category: t.category,
    }));
  } catch { return []; }
}

async function fetchMarketing(): Promise<CalendarItem[]> {
  try {
    const res = await fetch("/api/marketing");
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.campaigns ?? []).filter((c: any) => c.postDate).map((c: any) => ({
      id: c.id,
      title: c.title,
      date: c.postDate,
      type: "marketing" as const,
      status: c.status,
      assignee: c.assignee,
      channel: c.channels?.[0] ?? null,
    }));
  } catch { return []; }
}

// ---- Day Cell ----
function DayCell({
  date, items, isCurrentMonth, isToday, isSelected, onClick,
}: {
  date: Date; items: CalendarItem[]; isCurrentMonth: boolean;
  isToday: boolean; isSelected: boolean; onClick: () => void;
}) {
  const MAX_SHOW = 3;
  const visible  = items.slice(0, MAX_SHOW);
  const overflow = items.length - MAX_SHOW;

  return (
    <div
      onClick={onClick}
      style={{
        minHeight: 90, padding: "6px 6px 4px", cursor: "pointer",
        background: isSelected ? "#F0EEF8" : isToday ? "#FEFDF8" : "#fff",
        border: `0.5px solid ${isSelected ? "#CECBF6" : isToday ? "#FAC775" : "#e5e3db"}`,
        borderRadius: 8, opacity: isCurrentMonth ? 1 : 0.38,
        transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 12, fontWeight: isToday ? 600 : 400, marginBottom: 4,
        background: isToday ? "#534AB7" : "transparent",
        color: isToday ? "#fff" : isCurrentMonth ? "#1a1a18" : "#bbb",
      }}>
        {date.getDate()}
      </div>
      {visible.map((item) => {
        const s = TYPE_STYLE[item.type];
        return (
          <div key={item.id} style={{
            fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2,
            background: s.bg, color: s.color, border: `0.5px solid ${s.border}`,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.4,
          }}>
            {s.icon} {item.title}
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{ fontSize: 10, color: "#73726c", paddingLeft: 4 }}>+{overflow} รายการ</div>
      )}
    </div>
  );
}

// ---- Side Panel ----
function SidePanel({ date, items, onClose }: { date: Date; items: CalendarItem[]; onClose: () => void }) {
  const dayName = DAY_TH[date.getDay()];
  const dateStr = `${dayName} ${date.getDate()} ${MONTH_TH[date.getMonth()]} ${date.getFullYear() + 543}`;

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 320,
      background: "#fff", borderLeft: "0.5px solid #e5e3db",
      overflowY: "auto", padding: "20px 18px", zIndex: 100,
      boxShadow: "-4px 0 20px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#1a1a18" }}>{dateStr}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#73726c" }}>{items.length} รายการ</p>
        </div>
        <button onClick={onClose} style={{ marginLeft: "auto", fontSize: 18, background: "none", border: "none", cursor: "pointer", color: "#73726c", padding: "4px 8px" }}>✕</button>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", paddingTop: 40 }}>ไม่มีรายการวันนี้</p>
      ) : (
        items.map((item) => {
          const s = TYPE_STYLE[item.type];
          return (
            <div key={item.id} style={{
              background: "#faf9f5", border: "0.5px solid #e5e3db", borderRadius: 10,
              padding: "12px 14px", marginBottom: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 99,
                  background: s.bg, color: s.color, border: `0.5px solid ${s.border}`, fontWeight: 500,
                }}>
                  {s.icon} {s.label}
                </span>
                {item.priority && (
                  <span style={{ fontSize: 10, color: PRIORITY_COLOR[item.priority] ?? "#73726c" }}>
                    ● {item.priority}
                  </span>
                )}
              </div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1a1a18", lineHeight: 1.4 }}>
                {item.title}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {item.status   && <span style={{ fontSize: 11, color: "#73726c" }}>สถานะ: {item.status}</span>}
                {item.assignee && <span style={{ fontSize: 11, color: "#73726c" }}>👤 {item.assignee}</span>}
                {item.category && <span style={{ fontSize: 11, color: "#73726c" }}>🏷 {item.category}</span>}
                {item.channel  && <span style={{ fontSize: 11, color: "#73726c" }}>📡 {item.channel}</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---- Main Page ----
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [items, setItems]   = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(formatDateKey(today));
  const [filter, setFilter] = useState<"all" | "task" | "event" | "marketing">("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tasks, marketing] = await Promise.all([fetchTasks(), fetchMarketing()]);
    setItems([...tasks, ...marketing]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const days = getDaysInMonth(year, month);
  const todayKey = formatDateKey(today);

  // group by date
  const byDate: Record<string, CalendarItem[]> = {};
  items
    .filter((i) => filter === "all" || i.type === filter)
    .forEach((i) => {
      if (!byDate[i.date]) byDate[i.date] = [];
      byDate[i.date].push(i);
    });

  const selectedItems = selected ? (byDate[selected] ?? []) : [];

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  // count summary for current month
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthItems = items.filter((i) => i.date.startsWith(monthKey));
  const taskCount  = monthItems.filter((i) => i.type === "task").length;
  const mktCount   = monthItems.filter((i) => i.type === "marketing").length;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "sans-serif", background: "#f6f5f0" }}>

      {/* Main Calendar */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", marginRight: selected ? 320 : 0, transition: "margin-right 0.2s" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "#1a1a18" }}>🗓 Fryday — ปฏิทิน</h1>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <button onClick={prevMonth} style={{ fontSize: 16, padding: "4px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fff", cursor: "pointer", color: "#1a1a18" }}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#1a1a18", minWidth: 140, textAlign: "center" }}>
              {MONTH_TH[month]} {year + 543}
            </span>
            <button onClick={nextMonth} style={{ fontSize: 16, padding: "4px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fff", cursor: "pointer", color: "#1a1a18" }}>›</button>
            <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(todayKey); }}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "#fff", color: "#73726c", cursor: "pointer", marginLeft: 4 }}>
              วันนี้
            </button>
          </div>

          {/* Filter */}
          <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
            {(["all","task","marketing"] as const).map((f) => {
              const s = f === "all" ? null : TYPE_STYLE[f];
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 99,
                  border: `0.5px solid ${active && s ? s.border : active ? "#534AB7" : "#d3d1c7"}`,
                  background: active && s ? s.bg : active ? "#EEEDFE" : "transparent",
                  color: active && s ? s.color : active ? "#3C3489" : "#73726c",
                  cursor: "pointer",
                }}>
                  {f === "all" ? "ทั้งหมด" : `${TYPE_STYLE[f].icon} ${TYPE_STYLE[f].label}`}
                </button>
              );
            })}
            <button onClick={fetchAll} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "transparent", color: "#73726c", cursor: "pointer" }}>
              🔄
            </button>
          </div>
        </div>

        {/* Month summary */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: "#E6F1FB", color: "#185FA5", border: "0.5px solid #B5D4F4" }}>
            📋 {taskCount} งานเดือนนี้
          </div>
          <div style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: "#EEEDFE", color: "#3C3489", border: "0.5px solid #CECBF6" }}>
            📣 {mktCount} โพสต์เดือนนี้
          </div>
          {loading && <div style={{ fontSize: 12, color: "#73726c", padding: "4px 0" }}>กำลังโหลด...</div>}
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {DAY_TH.map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 500, color: i === 0 ? "#D85A30" : i === 6 ? "#185FA5" : "#73726c", padding: "4px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {days.map((d, idx) => {
            const key = formatDateKey(d);
            return (
              <DayCell
                key={idx}
                date={d}
                items={byDate[key] ?? []}
                isCurrentMonth={d.getMonth() === month}
                isToday={key === todayKey}
                isSelected={key === selected}
                onClick={() => setSelected(key === selected ? null : key)}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {(Object.entries(TYPE_STYLE) as [keyof typeof TYPE_STYLE, typeof TYPE_STYLE[keyof typeof TYPE_STYLE]][]).map(([k, s]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#73726c" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.bg, border: `0.5px solid ${s.border}` }} />
              {s.icon} {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Side Panel */}
      {selected && (
        <SidePanel
          date={new Date(selected + "T00:00:00")}
          items={selectedItems}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}