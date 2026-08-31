"use client";

import { useEffect, useState, useCallback } from "react";

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
  note?: string | null;
  deadline?: string | null;
}

const TYPE_STYLE = {
  task:      { bg: "#FEE9E7", color: "#C0200A", border: "#F5C0B8", icon: "📋", label: "งาน" },
  event:     { bg: "#EAF3DE", color: "#27500A", border: "#C0DD97", icon: "📅", label: "กิจกรรม" },
  marketing: { bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6", icon: "📣", label: "Marketing" },
};

const PRIORITY_COLOR: Record<string, string> = {
  ด่วนมาก: "#C0200A", ปานกลาง: "#CB8A1A", ไม่เร่งด่วน: "#1D9E75",
};

const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function formatDateKey(d: Date): string { return d.toISOString().slice(0, 10); }
function formatDateTH(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  for (let i = 0; i < first.getDay(); i++) days.push(new Date(year, month, 1 - (first.getDay() - i)));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length < 42) days.push(new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1));
  return days;
}

async function fetchTasks(): Promise<CalendarItem[]> {
  try {
    const res = await fetch("/api/tasks?done=false");
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.tasks ?? []).filter((t: any) => t.deadline).map((t: any) => ({
      id: t.id, title: t.name, date: t.deadline, type: "task" as const,
      status: t.status, priority: t.priority, assignee: t.assignee,
      category: t.category, note: t.note,
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
      id: c.id, title: c.title, date: c.postDate, type: "marketing" as const,
      status: c.status, assignee: c.assignee, channel: c.channels?.[0] ?? null,
    }));
  } catch { return []; }
}

// ---- Detail Card ----
function DetailCard({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const s = TYPE_STYLE[item.type];
  const isOverdue = item.date < new Date().toISOString().slice(0, 10);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "20px 16px 32px", width: "100%", maxHeight: "70vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 99, margin: "0 auto 16px" }} />

        {/* Type badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color, border: `0.5px solid ${s.border}`, fontWeight: 600 }}>
            {s.icon} {s.label}
          </span>
          {item.priority && (
            <span style={{ fontSize: 11, color: PRIORITY_COLOR[item.priority] ?? "#666", fontWeight: 500 }}>
              ● {item.priority}
            </span>
          )}
          {isOverdue && item.type === "task" && (
            <span style={{ fontSize: 11, color: "#C0200A", fontWeight: 600 }}>⚠️ เกิน Deadline</span>
          )}
        </div>

        {/* Title */}
        <p style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600, color: "#1a1a18", lineHeight: 1.4 }}>
          {item.title}
        </p>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#faf9f5", borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>วันที่</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: isOverdue && item.type === "task" ? "#C0200A" : "#1a1a18" }}>
                {formatDateTH(item.date)}
              </p>
            </div>
          </div>

          {item.status && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#faf9f5", borderRadius: 10 }}>
              <span style={{ fontSize: 16 }}>🔄</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>สถานะ</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.status}</p>
              </div>
            </div>
          )}

          {item.assignee && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#faf9f5", borderRadius: 10 }}>
              <span style={{ fontSize: 16 }}>👤</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>ผู้รับผิดชอบ</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.assignee}</p>
              </div>
            </div>
          )}

          {item.category && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#faf9f5", borderRadius: 10 }}>
              <span style={{ fontSize: 16 }}>🏷️</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>หมวดหมู่</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.category}</p>
              </div>
            </div>
          )}

          {item.channel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#faf9f5", borderRadius: 10 }}>
              <span style={{ fontSize: 16 }}>📡</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>ช่องทาง</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.channel}</p>
              </div>
            </div>
          )}

          {item.note && (
            <div style={{ padding: "10px 12px", background: "#faf9f5", borderRadius: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#73726c" }}>📝 หมายเหตุ</p>
              <p style={{ margin: 0, fontSize: 14, color: "#1a1a18", lineHeight: 1.5 }}>{item.note}</p>
            </div>
          )}
        </div>

        <button onClick={onClose} style={{
          width: "100%", marginTop: 16, padding: "12px", borderRadius: 10,
          border: "0.5px solid #e5e3db", background: "#fff",
          fontSize: 14, color: "#73726c", cursor: "pointer",
        }}>
          ปิด
        </button>
      </div>
    </div>
  );
}

// ---- Day Cell ----
function DayCell({ date, items, isCurrentMonth, isToday, isSelected, onClick }: {
  date: Date; items: CalendarItem[]; isCurrentMonth: boolean;
  isToday: boolean; isSelected: boolean; onClick: () => void;
}) {
  const MAX_SHOW = 2;
  const visible  = items.slice(0, MAX_SHOW);
  const overflow = items.length - MAX_SHOW;

  return (
    <div onClick={onClick} style={{
      minHeight: 64, padding: "4px 3px 3px", cursor: "pointer",
      background: isSelected ? "#FEE9E7" : isToday ? "#FFF8F7" : "#fff",
      border: `0.5px solid ${isSelected ? "#F5C0B8" : isToday ? "#FAC775" : "#e5e3db"}`,
      borderRadius: 8, opacity: isCurrentMonth ? 1 : 0.35,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 11, fontWeight: isToday ? 700 : 400, marginBottom: 3,
        background: isToday ? "#C0200A" : "transparent",
        color: isToday ? "#fff" : isCurrentMonth ? "#1a1a18" : "#bbb",
      }}>
        {date.getDate()}
      </div>
      {visible.map((item) => {
        const s = TYPE_STYLE[item.type];
        return (
          <div key={item.id} style={{
            fontSize: 9, padding: "1px 4px", borderRadius: 3, marginBottom: 2,
            background: s.bg, color: s.color, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.5,
          }}>
            {s.icon} {item.title}
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{ fontSize: 9, color: "#C0200A", paddingLeft: 3, fontWeight: 500 }}>+{overflow}</div>
      )}
    </div>
  );
}

// ---- Selected Day Panel ----
function DayPanel({ date, items, onSelectItem }: {
  date: Date; items: CalendarItem[]; onSelectItem: (item: CalendarItem) => void;
}) {
  const dayName = DAY_TH[date.getDay()];
  const dateStr = `${dayName} ${date.getDate()} ${MONTH_TH[date.getMonth()]} ${date.getFullYear() + 543}`;
  const today = formatDateKey(new Date());
  const isToday = formatDateKey(date) === today;

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #e5e3db", overflow: "hidden", marginTop: 12 }}>
      {/* Header */}
      <div style={{ background: isToday ? "#C0200A" : "#f6f5f0", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isToday ? "#fff" : "#1a1a18" }}>{dateStr}</p>
        <span style={{ fontSize: 12, color: isToday ? "rgba(255,255,255,0.8)" : "#73726c" }}>{items.length} รายการ</span>
      </div>

      {items.length === 0 ? (
        <p style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "#aaa", margin: 0 }}>
          ไม่มีรายการวันนี้
        </p>
      ) : (
        <div style={{ padding: "8px 12px" }}>
          {items.map((item) => {
            const s = TYPE_STYLE[item.type];
            const overdue = item.date < today && item.type === "task";
            return (
              <div key={item.id} onClick={() => onSelectItem(item)} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                borderBottom: "0.5px solid #f1efe8", marginBottom: 2,
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: s.bg, color: s.color }}>{s.label}</span>
                    {item.status && <span style={{ fontSize: 10, color: "#73726c" }}>{item.status}</span>}
                    {item.assignee && <span style={{ fontSize: 10, color: "#73726c" }}>👤 {item.assignee}</span>}
                    {overdue && <span style={{ fontSize: 10, color: "#C0200A", fontWeight: 600 }}>⚠️ เกิน!</span>}
                  </div>
                </div>
                <span style={{ fontSize: 16, color: "#d3d1c7" }}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear]       = useState(today.getFullYear());
  const [month, setMonth]     = useState(today.getMonth());
  const [items, setItems]     = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(formatDateKey(today));
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  const [filter, setFilter]   = useState<"all" | "task" | "marketing">("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tasks, marketing] = await Promise.all([fetchTasks(), fetchMarketing()]);
    setItems([...tasks, ...marketing]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const days    = getDaysInMonth(year, month);
  const todayKey = formatDateKey(today);

  const byDate: Record<string, CalendarItem[]> = {};
  items.filter((i) => filter === "all" || i.type === filter)
    .forEach((i) => { if (!byDate[i.date]) byDate[i.date] = []; byDate[i.date].push(i); });

  const selectedItems = selected ? (byDate[selected] ?? []) : [];
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthItems = items.filter((i) => i.date.startsWith(monthKey));

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  return (
    <>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "16px 12px 40px", fontFamily: "sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={prevMonth} style={{ fontSize: 18, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #e5e3db", background: "#fff", cursor: "pointer", color: "#1a1a18" }}>‹</button>
          <p style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 600, color: "#1a1a18", textAlign: "center" }}>
            {MONTH_TH[month]} {year + 543}
          </p>
          <button onClick={nextMonth} style={{ fontSize: 18, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #e5e3db", background: "#fff", cursor: "pointer", color: "#1a1a18" }}>›</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(todayKey); }}
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #e5e3db", background: "#fff", color: "#C0200A", cursor: "pointer", fontWeight: 500 }}>
            วันนี้
          </button>
          <button onClick={fetchAll} style={{ fontSize: 14, padding: "6px 10px", borderRadius: 8, border: "0.5px solid #e5e3db", background: "#fff", color: "#73726c", cursor: "pointer" }}>↻</button>
        </div>

        {/* Summary pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, padding: "4px 12px", borderRadius: 99, background: "#FEE9E7", color: "#C0200A", border: "0.5px solid #F5C0B8", fontWeight: 500 }}>
            📋 {monthItems.filter(i => i.type === "task").length} งาน
          </div>
          <div style={{ fontSize: 11, padding: "4px 12px", borderRadius: 99, background: "#EEEDFE", color: "#3C3489", border: "0.5px solid #CECBF6", fontWeight: 500 }}>
            📣 {monthItems.filter(i => i.type === "marketing").length} โพสต์
          </div>
          {loading && <div style={{ fontSize: 11, color: "#73726c", padding: "4px 0" }}>กำลังโหลด...</div>}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["all","task","marketing"] as const).map((f) => {
            const labels = { all: "ทั้งหมด", task: "📋 งาน", marketing: "📣 Marketing" };
            const colors = { all: { bg: "#f6f5f0", color: "#1a1a18", border: "#d3d1c7" }, task: { bg: "#FEE9E7", color: "#C0200A", border: "#F5C0B8" }, marketing: { bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6" } };
            const c = colors[f];
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 99, cursor: "pointer",
                border: `0.5px solid ${filter === f ? c.border : "#d3d1c7"}`,
                background: filter === f ? c.bg : "transparent",
                color: filter === f ? c.color : "#73726c",
                fontWeight: filter === f ? 500 : 400,
              }}>{labels[f]}</button>
            );
          })}
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
          {DAY_TH.map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: i === 0 ? "#C0200A" : i === 6 ? "#185FA5" : "#73726c", padding: "3px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {days.map((d, idx) => {
            const key = formatDateKey(d);
            return (
              <DayCell key={idx} date={d} items={byDate[key] ?? []}
                isCurrentMonth={d.getMonth() === month}
                isToday={key === todayKey}
                isSelected={key === selected}
                onClick={() => setSelected(key === selected ? null : key)}
              />
            );
          })}
        </div>

        {/* Day Detail Panel */}
        {selected && (
          <DayPanel
            date={new Date(selected + "T00:00:00")}
            items={selectedItems}
            onSelectItem={setDetailItem}
          />
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          {(Object.entries(TYPE_STYLE) as [keyof typeof TYPE_STYLE, typeof TYPE_STYLE[keyof typeof TYPE_STYLE]][]).map(([k, s]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#73726c" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.bg, border: `0.5px solid ${s.border}` }} />
              {s.icon} {s.label}
            </div>
          ))}
        </div>
      </main>

      {/* Detail Modal */}
      {detailItem && <DetailCard item={detailItem} onClose={() => setDetailItem(null)} />}

      <style>{`
        * { box-sizing: border-box; }
        body { background: #FBF8F5; -webkit-font-smoothing: antialiased; }
        @media (max-width: 640px) {
          main { padding: 12px 8px 80px !important; }
        }
      `}</style>
    </>
  );
}