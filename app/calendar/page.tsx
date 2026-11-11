"use client";

import { useEffect, useState, useCallback } from "react";
import "../bento.css";
import { buildIcs, downloadIcs } from "../marketing/planner/ics";

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
  channels?: string[];
  contentType?: string | null;
  note?: string | null;
  deadline?: string | null;
}

const TYPE_STYLE = {
  task:      { bg: "#FDE1DA", color: "#B3200A", border: "#F5C0B8", icon: "", label: "งาน" },
  event:     { bg: "#E3F1E6", color: "#1F5A2E", border: "#B9D9C0", icon: "", label: "กิจกรรม" },
  marketing: { bg: "#2A0B07", color: "#FFD9CE", border: "#2A0B07", icon: "", label: "โพสต์" },
};

const PRIORITY_COLOR: Record<string, string> = {
  ด่วนมาก: "#C0200A", ปานกลาง: "#CB8A1A", ไม่เร่งด่วน: "#1D9E75",
};

const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

// ใช้วันที่ตามเวลาเครื่อง (ไม่ใช่ UTC) ไม่งั้นช่องวันจะเลื่อนผิดไป 1 วันในประเทศไทย
function formatDateKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
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
      status: c.status, assignee: c.assignee, channel: c.channels?.[0] ?? null, channels: c.channels ?? [], contentType: c.contentType ?? null,
    }));
  } catch { return []; }
}

// ---- Detail Card ----
function DetailCard({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const s = TYPE_STYLE[item.type];
  const isOverdue = item.date < formatDateKey(new Date());

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "26px 26px 0 0", padding: "20px 18px 32px", width: "100%", maxHeight: "70vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 99, margin: "0 auto 16px" }} />

        {/* Type badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color, border: `0.5px solid ${s.border}`, fontWeight: 600 }}>
            {s.label}
          </span>
          {item.priority && (
            <span style={{ fontSize: 11, color: PRIORITY_COLOR[item.priority] ?? "#666", fontWeight: 500 }}>
              ● {item.priority}
            </span>
          )}
          {isOverdue && item.type === "task" && (
            <span style={{ fontSize: 11, color: "#C0200A", fontWeight: 600 }}>เกินกำหนด</span>
          )}
        </div>

        {/* Title */}
        <p style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600, color: "#1a1a18", lineHeight: 1.4 }}>
          {item.title}
        </p>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#FBF4F0", borderRadius: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>วันที่</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: isOverdue && item.type === "task" ? "#C0200A" : "#1a1a18" }}>
                {formatDateTH(item.date)}
              </p>
            </div>
          </div>

          {item.status && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#FBF4F0", borderRadius: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>สถานะ</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.status}</p>
              </div>
            </div>
          )}

          {item.assignee && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#FBF4F0", borderRadius: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>ผู้รับผิดชอบ</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.assignee}</p>
              </div>
            </div>
          )}

          {item.category && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#FBF4F0", borderRadius: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>หมวดหมู่</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.category}</p>
              </div>
            </div>
          )}

          {item.channel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#FBF4F0", borderRadius: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#73726c" }}>ช่องทาง</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{item.channel}</p>
              </div>
            </div>
          )}

          {item.note && (
            <div style={{ padding: "10px 12px", background: "#FBF4F0", borderRadius: 14 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#73726c" }}>หมายเหตุ</p>
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
  const weekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <button type="button" onClick={onClick} aria-pressed={isSelected} aria-label={`${date.getDate()} ${MONTH_TH[date.getMonth()]} ${items.length} รายการ`}
      className={`cal-cell${isSelected ? " sel" : ""}${weekend ? " weekend" : ""}${isCurrentMonth ? "" : " other"}`}>
      <span className={`cal-num${isToday ? " today" : ""}`}>{date.getDate()}</span>
      {items.length > 1 && <span className="cal-count" aria-hidden="true">{items.length} รายการ</span>}
      {visible.map((item) => {
        const s = TYPE_STYLE[item.type];
        return (
          <div key={item.id} className="cal-chip" style={{ background: s.bg, color: s.color }}>
            {item.title.replace(/^คลิป (\d+):.*/, "คลิป $1")}
          </div>
        );
      })}
      {overflow > 0 && <div className="cal-more">+{overflow}</div>}
    </button>
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
    <div style={{ background: "#fff", borderRadius: 22, border: "1px solid #EBD9D2", overflow: "hidden", marginTop: 12 }}>
      {/* Header */}
      <div style={{ background: isToday ? "#2A0B07" : "#FBF4F0", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                <div style={{ width: 4, alignSelf: "stretch", minHeight: 30, borderRadius: 99, background: item.type === "marketing" ? "#2A0B07" : s.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: s.bg, color: s.color }}>{s.label}</span>
                    {item.status && <span style={{ fontSize: 10, color: "#73726c" }}>{item.status}</span>}
                    {item.assignee && <span style={{ fontSize: 10, color: "#73726c" }}>{item.assignee}</span>}
                    {overdue && <span style={{ fontSize: 10, color: "#C0200A", fontWeight: 600 }}>เกิน</span>}
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
  const [exp, setExp] = useState(false);
  const [expOpt, setExpOpt] = useState({ tasks: true, posts: true, shoots: true });
  const [expMsg, setExpMsg] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tasks, marketing] = await Promise.all([fetchTasks(), fetchMarketing()]);
    setItems([...tasks, ...marketing]);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(fetchAll); }, [fetchAll]);

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

  const exportIcs = () => {
    const mk = items.filter((i) => i.type === "marketing").map((i) => ({ id: i.id, title: i.title, contentType: i.contentType ?? null, channels: i.channels ?? [], status: i.status ?? "", postDate: i.date }));
    const tk = expOpt.tasks ? items.filter((i) => i.type === "task").map((i) => ({ id: i.id, title: i.title, date: i.date, priority: i.priority, assignee: i.assignee, category: i.category, note: i.note })) : [];
    const { text, count } = buildIcs(mk, { posts: expOpt.posts, shoots: expOpt.shoots, includeDone: false }, tk);
    if (!count) { setExpMsg("ไม่มีรายการที่จะส่งออก ลองติ๊กประเภทอื่นเพิ่ม"); return; }
    downloadIcs(text, "fryday-calendar.ics");
    setExpMsg(`สร้างไฟล์แล้ว ${count} รายการ เปิดไฟล์ที่ดาวน์โหลดเพื่อเพิ่มลงปฏิทิน`);
  };

  const FILTERS = { all: "ทั้งหมด", task: "งาน", marketing: "โพสต์" } as const;

  return (
    <>
      <main className="cal">
        <div className="cal-top">
          <div className="cal-nav">
            <button onClick={prevMonth} aria-label="เดือนก่อน">‹</button>
            <h1>{MONTH_TH[month]} {year + 543}</h1>
            <button onClick={nextMonth} aria-label="เดือนถัดไป">›</button>
            <button className="cal-today" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(todayKey); }}>วันนี้</button>
            <button onClick={fetchAll} aria-label="โหลดใหม่" disabled={loading}>↻</button>
          </div>
          <div className="cal-seg" role="group" aria-label="กรองรายการ">
            {(["all", "task", "marketing"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}>{FILTERS[f]}</button>
            ))}
          </div>
          <div className="cal-sum">
            <span style={{ background: "#FDE1DA", color: "#B3200A" }}>{monthItems.filter(i => i.type === "task").length} งาน</span>
            <span style={{ background: "#2A0B07", color: "#FFD9CE" }}>{monthItems.filter(i => i.type === "marketing").length} โพสต์</span>
            {loading && <em>กำลังโหลด…</em>}
          </div>
          <button className="cal-export" aria-expanded={exp} onClick={() => { setExp((v) => !v); setExpMsg(""); }}>ลงปฏิทินมือถือ</button>
        </div>

        {exp && (
          <div className="cal-exp" role="group" aria-label="ส่งออกลงปฏิทินมือถือ">
            <strong>ดาวน์โหลดเป็นไฟล์ปฏิทิน (.ics)</strong>
            <div className="cal-exp-opts">
              <label><input type="checkbox" checked={expOpt.tasks} onChange={(e) => setExpOpt((o) => ({ ...o, tasks: e.target.checked }))} /> งาน (เตือน 9 โมงเช้าวันครบกำหนด)</label>
              <label><input type="checkbox" checked={expOpt.posts} onChange={(e) => setExpOpt((o) => ({ ...o, posts: e.target.checked }))} /> โพสต์ Marketing (เตือนก่อน 30 นาที)</label>
              <label><input type="checkbox" checked={expOpt.shoots} onChange={(e) => setExpOpt((o) => ({ ...o, shoots: e.target.checked }))} /> วันถ่ายคลิป</label>
            </div>
            <button className="cal-primary" disabled={!expOpt.tasks && !expOpt.posts && !expOpt.shoots} onClick={exportIcs}>ดาวน์โหลดไฟล์ปฏิทิน</button>
            {expMsg && <p role="status" style={{ color: expMsg.startsWith("ไม่มี") ? "#C0200A" : "#27500A" }}>{expMsg}</p>}
            <small>iPhone: เปิดไฟล์แล้วกด “เพิ่มทั้งหมด” · Android: เปิดด้วย Google Calendar · นำเข้าซ้ำได้ ระบบอัปเดตรายการเดิม ไม่สร้างเบิ้ล · เฉพาะงานที่ยังไม่เสร็จ</small>
          </div>
        )}

        <div className="cal-body">
          <section className="cal-main" aria-label="ปฏิทินรายเดือน">
            <div className="cal-grid">
              {DAY_TH.map((d, i) => (
                <div key={d} className="cal-dow" style={{ color: i === 0 ? "#C0200A" : i === 6 ? "#8F1B0B" : "#7A6A64" }}>{d}</div>
              ))}
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
          </section>

          <aside className="cal-side">
            {selected
              ? <DayPanel date={new Date(selected + "T00:00:00")} items={selectedItems} onSelectItem={setDetailItem} />
              : <p className="cal-hint">เลือกวันในปฏิทินเพื่อดูรายการ</p>}
            <div className="cal-legend">
              {(Object.entries(TYPE_STYLE) as [keyof typeof TYPE_STYLE, typeof TYPE_STYLE[keyof typeof TYPE_STYLE]][]).map(([k, s]) => (
                <div key={k}><i style={{ background: s.bg, border: `0.5px solid ${s.border}` }} />{s.label}</div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      {/* Detail Modal */}
      {detailItem && <DetailCard item={detailItem} onClose={() => setDetailItem(null)} />}

      <style>{`
        * { box-sizing: border-box; }
        body { background: #F7EFEA !important; -webkit-font-smoothing: antialiased; }
        .cal { --red:#C0200A; --ink:#2A0B07; --line:#EBD9D2; max-width: 1180px; margin: 0 auto; padding: 16px 16px 40px; color: var(--ink); }
        .cal button { font: inherit; transition: background-color .15s, border-color .15s, filter .15s; }
        .cal button:not(:disabled):hover { filter: brightness(.97); }
        .cal button:disabled { opacity: .5; cursor: not-allowed; }
        .cal button:focus-visible, .cal input:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
        .cal-top { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; margin-bottom: 12px; background: radial-gradient(120% 160% at 100% 0%, #8F1B0B 0%, #4A0F08 55%, #2A0B07 100%); color: #fff; border-radius: 24px; padding: 12px 18px; }
        .cal-nav { display: flex; align-items: center; gap: 6px; }
        .cal-nav h1 { margin: 0; font-size: 20px; font-weight: 600; min-width: 150px; text-align: center; }
        .cal-nav button, .cal-export { font-size: 14px; padding: 6px 14px; border: 1px solid rgba(255,255,255,.28); border-radius: 99px; background: transparent; cursor: pointer; color: #fff; }
        .cal-nav .cal-today { font-size: 12px; background: #FF8A66; border-color: #FF8A66; color: #3A0D06; font-weight: 600; }
        .cal-export { margin-left: auto; font-weight: 600; font-size: 13px; }
        .cal-seg { display: flex; background: rgba(255,255,255,.1); border-radius: 99px; padding: 3px; gap: 2px; }
        .cal-seg button { border: none; background: transparent; font-size: 13px; padding: 5px 14px; border-radius: 99px; cursor: pointer; color: rgba(255,255,255,.8); white-space: nowrap; }
        .cal-seg button[aria-pressed="true"] { background: #fff; color: var(--ink); font-weight: 600; }
        .cal-sum { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .cal-sum span { font-size: 12px; padding: 3px 10px; border-radius: 99px; font-weight: 500; }
        .cal-sum em { font-size: 12px; color: rgba(255,255,255,.7); font-style: normal; }
        .cal-exp { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 12px 14px; margin-bottom: 12px; font-size: 13px; }
        .cal-exp-opts { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
        .cal-primary { background: var(--red); color: #fff; border: 1px solid var(--red); border-radius: 99px; padding: 8px 18px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .cal-exp p { margin: 8px 0 0; }
        .cal-exp small { display: block; margin-top: 8px; color: #73726c; font-size: 12px; }
        .cal-body { display: flex; gap: 16px; align-items: flex-start; }
        .cal-main { flex: 2 1 0; min-width: 0; background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 14px 16px; }
        .cal-side { flex: 1 1 0; min-width: 280px; max-width: 420px; }
        .cal-side > div:first-child { margin-top: 0 !important; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
        .cal-dow { text-align: center; font-size: 12px; font-weight: 600; padding: 2px 0 4px; }
        .cal-cell { min-height: 78px; text-align: left; padding: 5px 4px 3px; border-radius: 14px; background: #fff; border: 1px solid var(--line); cursor: pointer; overflow: hidden; color: inherit; display: block; width: 100%; }
        .cal-cell.weekend { background: #FBF4F0; }
        .cal-cell.other { opacity: .4; }
        .cal-cell.sel { border-color: var(--ink); background: #FDE8E4; box-shadow: 0 0 0 1px var(--ink) inset; }
        .cal-num { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; border-radius: 99px; font-size: 12px; margin-bottom: 2px; }
        .cal-num.today { background: var(--ink); color: #fff; font-weight: 700; }
        .cal-count { display: none; font-size: 10px; color: #73726c; margin-left: 4px; }
        .cal-chip { font-size: 10px; padding: 1px 6px; border-radius: 99px; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.5; }
        .cal-more { font-size: 10px; color: var(--red); padding-left: 3px; font-weight: 500; }
        .cal-hint { margin: 0; padding: 20px; text-align: center; font-size: 13px; color: #73726c; background: #fff; border: 1px dashed var(--line); border-radius: 22px; }
        .cal-legend { display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
        .cal-legend div { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #73726c; }
        .cal-legend i { display: block; width: 10px; height: 10px; border-radius: 3px; }

        @media (max-width: 899px) {
          .cal-body { flex-direction: column; }
          .cal-main, .cal-side { width: 100%; max-width: none; flex: none; }
          .cal-export { margin-left: 0; }
        }
        @media (max-width: 640px) {
          .cal { padding: 12px 8px 80px; }
          .cal-cell { min-height: 56px; padding: 3px; }
          .cal-chip { font-size: 9px; }
          .cal-nav h1 { min-width: 0; flex: 1; font-size: 17px; }
          .cal-nav { width: 100%; }
        }
        /* จอคอม: ทั้งหน้าพอดีความสูงจอ ช่องวันยืดตามพื้นที่ ส่วนขวาเลื่อนในตัวเอง */
        @media (min-width: 900px) and (min-height: 620px) {
          .cal { height: calc(100dvh - 56px); display: flex; flex-direction: column; overflow: hidden; padding-top: 12px; padding-bottom: 14px; }
          .cal > * { flex-shrink: 0; }
          .cal-top { margin-bottom: 8px; }
          .cal-body { flex: 1 1 0; min-height: 0; align-items: stretch; }
          .cal-main { display: flex; flex-direction: column; min-height: 0; }
          .cal-grid { flex: 1; min-height: 0; grid-template-rows: auto repeat(6, minmax(0, 1fr)); }
          .cal-cell { min-height: 0; }
          .cal-side { overflow-y: auto; }
        }
        @media (min-width: 900px) and (min-height: 620px) and (max-height: 820px) {
          .cal-chip:nth-of-type(n+2), .cal-more { display: none; }
          .cal-count { display: inline; }
        }
        @media (prefers-reduced-motion: reduce) { .cal * { transition: none !important; } }
      `}</style>
    </>
  );
}
