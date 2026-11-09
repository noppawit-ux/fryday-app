"use client";

import { useEffect, useState, useCallback } from "react";
import type { FrydayTask, TaskStatus } from "@/lib/notion";

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  รอดำเนินการ: { label: "🔵 รอดำเนินการ", color: "#185FA5", bg: "#E6F1FB", border: "#B5D4F4" },
  กำลังทำ:    { label: "🟡 กำลังทำ",     color: "#854F0B", bg: "#FAEEDA", border: "#FAC775" },
  เสร็จแล้ว:  { label: "🟢 เสร็จแล้ว",   color: "#27500A", bg: "#EAF3DE", border: "#C0DD97" },
  ติดปัญหา:   { label: "🔴 ติดปัญหา",    color: "#791F1F", bg: "#FCEBEB", border: "#F7C1C1" },
};

const PRIORITY_BADGE: Record<string, string> = {
  ด่วนมาก: "🔴", ปานกลาง: "🟠", ไม่เร่งด่วน: "🟢",
};

const CATEGORY_BADGE: Record<string, string> = {
  ครัว: "🍗", การเงิน: "💰", การตลาด: "📣", ทั่วไป: "🧹", HR: "👥",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function isOverdue(deadline: string | null, done: boolean): boolean {
  if (!deadline || done) return false;
  return new Date(deadline) < new Date();
}

function TaskCard({ task, onToggleDone, onChangeStatus }: {
  task: FrydayTask;
  onToggleDone: (id: string, done: boolean) => void;
  onChangeStatus: (id: string, status: TaskStatus) => void;
}) {
  const overdue = isOverdue(task.deadline, task.done);
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 10, padding: "12px 14px", opacity: task.done ? 0.55 : 1, transition: "opacity 0.2s", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input type="checkbox" aria-label="ทำเสร็จแล้ว" checked={task.done} onChange={() => onToggleDone(task.id, !task.done)} style={{ marginTop: 3, width: 18, height: 18, flex: "none", cursor: "pointer", accentColor: "#1D9E75" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 500, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, overflowWrap: "anywhere" }}>
            {CATEGORY_BADGE[task.category] ?? "📋"} {task.name}
          </p>
          <div style={{ display: "flex", gap: "2px 10px", marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            {task.assignee && <span style={{ fontSize: 12, color: "#73726c" }}>👤 {task.assignee}</span>}
            {task.deadline && <span style={{ fontSize: 12, color: overdue ? "#A32D2D" : "#73726c", fontWeight: overdue ? 500 : 400 }}>{overdue ? "⚠️" : "📅"} {formatDate(task.deadline)}</span>}
            <span style={{ fontSize: 12, color: "#73726c" }}>{PRIORITY_BADGE[task.priority]} {task.priority}</span>
          </div>
          {task.note && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#73726c", lineHeight: 1.5, overflowWrap: "anywhere" }}>{task.note}</p>}
        </div>
      </div>
      <select
        aria-label="เปลี่ยนสถานะ"
        value={task.status}
        onChange={(e) => onChangeStatus(task.id, e.target.value as TaskStatus)}
        style={{ marginTop: 10, width: "100%", font: "inherit", fontSize: 12.5, padding: "6px 8px", borderRadius: 8, border: `0.5px solid ${STATUS_CONFIG[task.status].border}`, background: STATUS_CONFIG[task.status].bg, color: STATUS_CONFIG[task.status].color, cursor: "pointer" }}
      >
        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
      </select>
    </div>
  );
}

function Column({ status, tasks, onToggleDone, onChangeStatus }: {
  status: TaskStatus; tasks: FrydayTask[];
  onToggleDone: (id: string, done: boolean) => void;
  onChangeStatus: (id: string, status: TaskStatus) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <section aria-label={cfg.label} style={{ background: "#f6f5f0", borderRadius: 12, padding: 10, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px 4px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: cfg.color, background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 99, padding: "2px 10px" }}>{cfg.label}</span>
        <span style={{ fontSize: 12, color: "#73726c", marginLeft: "auto" }}>{tasks.length} งาน</span>
      </div>
      {tasks.length === 0
        ? <p style={{ textAlign: "center", fontSize: 12.5, color: "#aaa", margin: 0, padding: "28px 0", border: "1px dashed #d3d1c7", borderRadius: 10 }}>ไม่มีงาน</p>
        : tasks.map((t) => <TaskCard key={t.id} task={t} onToggleDone={onToggleDone} onChangeStatus={onChangeStatus} />)
      }
    </section>
  );
}

const CATEGORIES = ["การตลาด", "ครัว", "การเงิน", "ทั่วไป", "HR"];
const PRIORITIES = ["ปานกลาง", "ด่วนมาก", "ไม่เร่งด่วน"];

function AddTaskForm({ onClose, onAdded }: { onClose: () => void; onAdded: (name: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [added, setAdded] = useState("");
  const [f, setF] = useState({ name: "", category: "การตลาด", priority: "ปานกลาง", deadline: "", note: "" });
  const inp: React.CSSProperties = { width: "100%", fontSize: 14, padding: "9px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fff", color: "#1a1a18", boxSizing: "border-box", font: "inherit" };
  const lab: React.CSSProperties = { display: "block", margin: "0 0 4px", fontSize: 12, color: "#73726c" };

  const submit = async () => {
    if (!f.name.trim()) { setErr("กรุณาใส่ชื่องาน"); return; }
    setBusy(true); setErr(""); setAdded("");
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, category: f.category, priority: f.priority, deadline: f.deadline || undefined, note: f.note || undefined, status: "รอดำเนินการ" }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setErr([data.error ?? "เชื่อมต่อไม่ได้", data.detail].filter(Boolean).join(" · ")); return; }
    const name = f.name.trim();
    setAdded(name);
    setF((x) => ({ ...x, name: "", note: "", deadline: "" }));
    onAdded(name);
  };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>เพิ่มงานใหม่</p>
      <div className="tk-form">
        <label className="tk-wide"><span style={lab}>ชื่องาน *</span>
          <input style={inp} autoFocus placeholder="เช่น ถ่ายคลิปพิกัดร้าน" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
        <label><span style={lab}>หมวดหมู่</span>
          <select style={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span style={lab}>ความสำคัญ</span>
          <select style={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span style={lab}>กำหนดเสร็จ</span>
          <input style={inp} type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></label>
        <label className="tk-wide"><span style={lab}>หมายเหตุ</span>
          <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      </div>
      {err && <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "#A32D2D" }}>❌ {err}</p>}
      {added && <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "#27500A" }}>✓ เพิ่มงาน “{added}” แล้ว กรอกต่อเพื่อเพิ่มงานถัดไปได้</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={submit} disabled={busy} style={{ fontSize: 14, padding: "9px 22px", borderRadius: 99, border: "none", background: "#C0200A", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: busy ? 0.6 : 1 }}>{busy ? "กำลังบันทึก…" : "บันทึกงาน"}</button>
        <button onClick={onClose} style={{ fontSize: 14, padding: "9px 18px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "transparent", color: "#73726c", cursor: "pointer" }}>ปิด</button>
      </div>
    </div>
  );
}

const LAYOUT_CSS = `
.tk-board{display:grid;gap:12px;align-items:start;grid-template-columns:repeat(4,minmax(0,1fr))}
.tk-board.one{grid-template-columns:minmax(0,640px)}
.tk-stats{display:grid;gap:10px;grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:16px}
.tk-form{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}
.tk-form .tk-wide{grid-column:1/-1}
@media (max-width:1100px){
  .tk-board{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:640px){
  .tk-board,.tk-board.one{grid-template-columns:minmax(0,1fr)}
  .tk-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tk-stats>:last-child{grid-column:1/-1}
  .tk-form{grid-template-columns:minmax(0,1fr)}
}
`;

export default function TasksPage() {
  const [tasks, setTasks] = useState<FrydayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");

  const fetchTasks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (!showDone) params.set("done", "false");
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setTasks(data.tasks);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [filter, showDone]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggleDone = async (id: string, done: boolean) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done, status: done ? "เสร็จแล้ว" : t.status } : t));
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done, status: done ? "เสร็จแล้ว" : undefined }) }).catch(() => null);
    if (!res?.ok) { setNotice("บันทึกการเปลี่ยนแปลงไม่สำเร็จ โหลดข้อมูลใหม่แล้ว"); fetchTasks(); }
  };

  const handleChangeStatus = async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    if (!res?.ok) { setNotice("บันทึกการเปลี่ยนแปลงไม่สำเร็จ โหลดข้อมูลใหม่แล้ว"); fetchTasks(); }
  };

  const allStatuses = Object.keys(STATUS_CONFIG) as TaskStatus[];
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);

  const pill = (active: boolean, color: string, bg: string, border: string): React.CSSProperties => ({ fontSize: 12.5, padding: "6px 12px", borderRadius: 99, border: `0.5px solid ${active ? border : "#e5e3db"}`, background: active ? bg : "transparent", color: active ? color : "#73726c", cursor: "pointer", fontWeight: active ? 500 : 400, whiteSpace: "nowrap" });

  return (
    <main style={{ padding: "24px 20px 60px", maxWidth: 1280, margin: "0 auto" }}>
      <style>{LAYOUT_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>🍗 Fryday — Task Manager</h1>
        <button onClick={() => { setAdding((v) => !v); setNotice(""); }} aria-expanded={adding} style={{ marginLeft: "auto", fontSize: 14, padding: "9px 20px", borderRadius: 99, border: "none", background: "#C0200A", color: "#fff", cursor: "pointer", fontWeight: 600 }}>{adding ? "ปิดฟอร์ม" : "+ เพิ่มงาน"}</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", ...allStatuses] as const).map((s) => {
          const c = s === "all" ? { color: "#27500A", bg: "#EAF3DE", border: "#1D9E75" } : STATUS_CONFIG[s];
          return <button key={s} onClick={() => setFilter(s)} style={pill(filter === s, c.color, c.bg, c.border)}>{s === "all" ? "ทุกสถานะ" : STATUS_CONFIG[s].label}</button>;
        })}
        <span style={{ flex: 1 }} />
        <button onClick={() => setShowDone((v) => !v)} style={pill(showDone, "#3C3489", "#EEEDFE", "#534AB7")}>{showDone ? "ซ่อนงานเสร็จ" : "แสดงงานเสร็จ"}</button>
        <button onClick={fetchTasks} style={pill(false, "", "", "")}>🔄 รีเฟรช</button>
      </div>

      {adding && <AddTaskForm onClose={() => setAdding(false)} onAdded={(name) => { setNotice(`เพิ่มงาน “${name}” แล้ว`); setFilter("all"); fetchTasks(); }} />}
      {notice && !adding && <p role="status" style={{ margin: "0 0 12px", fontSize: 13, color: notice.startsWith("เพิ่ม") ? "#27500A" : "#A32D2D" }}>{notice}</p>}

      {loading && <p style={{ color: "#73726c", fontSize: 14 }}>กำลังโหลด...</p>}
      {error   && <p style={{ color: "#A32D2D", fontSize: 14 }}>❌ {error}</p>}

      {!loading && !error && (
        <>
          <div className="tk-stats">
            {allStatuses.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <div key={s} style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 10, padding: "8px 14px", color: cfg.color }}>
                  <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{byStatus(s).length}</div>
                  <div style={{ fontSize: 12.5 }}>{cfg.label.replace(/^[^\s]+\s/, "")}</div>
                </div>
              );
            })}
            <div style={{ background: "#f6f5f0", border: "0.5px solid #e5e3db", borderRadius: 10, padding: "8px 14px", color: "#73726c" }}>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, color: "#1a1a18" }}>{tasks.length}</div>
              <div style={{ fontSize: 12.5 }}>งานทั้งหมด</div>
            </div>
          </div>
          <div className={filter === "all" ? "tk-board" : "tk-board one"}>
            {(filter === "all" ? allStatuses : [filter as TaskStatus]).map((s) => (
              <Column key={s} status={s} tasks={byStatus(s)} onToggleDone={handleToggleDone} onChangeStatus={handleChangeStatus} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
