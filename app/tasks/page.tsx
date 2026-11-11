"use client";

import { useEffect, useState, useCallback } from "react";
import type { FrydayTask, TaskStatus } from "@/lib/notion";
import "../bento.css";

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  รอดำเนินการ: { label: "รอดำเนินการ", color: "#B3200A", bg: "#FDE8E4", border: "#F5C0B8", dot: "#C0200A" },
  กำลังทำ:    { label: "กำลังทำ",     color: "#8A5300", bg: "#FFF0D6", border: "#F3D49A", dot: "#E0A12B" },
  เสร็จแล้ว:  { label: "เสร็จแล้ว",   color: "#1F5A2E", bg: "#E3F1E6", border: "#B9D9C0", dot: "#3C9A78" },
  ติดปัญหา:   { label: "ติดปัญหา",    color: "#2A0B07", bg: "#F1E4E0", border: "#D9B8AE", dot: "#2A0B07" },
};

// ความสำคัญ: ใช้ป้ายสีมีตัวหนังสือกำกับ (ไม่พึ่งสีอย่างเดียว)
const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  ด่วนมาก: { color: "#fff", bg: "#C0200A", border: "#C0200A" },
  ปานกลาง: { color: "#8A5300", bg: "#FFF0D6", border: "#F3D49A" },
  ไม่เร่งด่วน: { color: "#1F5A2E", bg: "#E3F1E6", border: "#B9D9C0" },
};

// หมวดหมู่: แถบสีด้านซ้ายของการ์ด + ป้ายชื่อหมวด
const CATEGORY_STYLE: Record<string, { bar: string; color: string; bg: string }> = {
  ครัว: { bar: "#E8895F", color: "#8A3A16", bg: "#FFE9DF" },
  การเงิน: { bar: "#3C9A78", color: "#1F5A2E", bg: "#E3F1E6" },
  การตลาด: { bar: "#C0200A", color: "#8F1B0B", bg: "#FDE1DA" },
  ทั่วไป: { bar: "#A89690", color: "#5F504A", bg: "#F1EBE7" },
  HR: { bar: "#2A0B07", color: "#2A0B07", bg: "#EADBD6" },
};
const CAT_FALLBACK = CATEGORY_STYLE["ทั่วไป"];

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, borderRadius: 99, background: color, flex: "none" }} />;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function isOverdue(deadline: string | null, done: boolean): boolean {
  if (!deadline || done) return false;
  return new Date(deadline) < new Date();
}

interface Person { id: string; name: string; avatar: string | null }
interface FormState { name: string; status: TaskStatus; category: string; priority: string; deadline: string; note: string; assigneeId: string }

const CATEGORIES = ["การตลาด", "ครัว", "การเงิน", "ทั่วไป", "HR"];
const PRIORITIES = ["ปานกลาง", "ด่วนมาก", "ไม่เร่งด่วน"];
const inp: React.CSSProperties = { width: "100%", fontSize: 14, padding: "9px 10px", borderRadius: 12, border: "1px solid #EBD9D2", background: "#FBF4F0", color: "#2A0B07", boxSizing: "border-box", font: "inherit" };
const lab: React.CSSProperties = { display: "block", margin: "0 0 4px", fontSize: 12, color: "#7A6A64" };

function Fields({ f, setF, people, peopleErr, showStatus, onEnter }: {
  f: FormState; setF: (f: FormState) => void; people: Person[]; peopleErr: string; showStatus: boolean; onEnter?: () => void;
}) {
  // ถ้างานมีผู้รับผิดชอบที่ไม่อยู่ในรายชื่อ (เช่น ดึงรายชื่อไม่ได้) ยังต้องแสดงค่าเดิมให้เห็น
  const known = people.some((p) => p.id === f.assigneeId);
  return (
    <div className="tk-form">
      <label className="tk-wide"><span style={lab}>ชื่องาน *</span>
        <input style={inp} autoFocus placeholder="เช่น ถ่ายคลิปพิกัดร้าน" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && onEnter?.()} /></label>
      <label><span style={lab}>ผู้รับผิดชอบ</span>
        <select style={inp} value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
          <option value="">— ยังไม่มอบหมาย —</option>
          {f.assigneeId && !known && <option value={f.assigneeId}>(คนเดิมของงานนี้)</option>}
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {peopleErr && <span style={{ display: "block", marginTop: 4, fontSize: 11.5, color: "#A32D2D" }}>{peopleErr}</span>}</label>
      {showStatus && (
        <label><span style={lab}>สถานะ</span>
          <select style={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TaskStatus })}>
            {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select></label>
      )}
      <label><span style={lab}>หมวดหมู่</span>
        <select style={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label><span style={lab}>ความสำคัญ</span>
        <select style={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label><span style={lab}>กำหนดเสร็จ</span>
        <input style={inp} type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></label>
      <label className="tk-wide"><span style={lab}>หมายเหตุ</span>
        <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
    </div>
  );
}

function EditModal({ task, people, peopleErr, onClose, onSaved }: {
  task: FrydayTask; people: Person[]; peopleErr: string; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [f, setF] = useState<FormState>({
    name: task.name === "(ไม่มีชื่อ)" ? "" : task.name,
    status: task.status, category: task.category, priority: task.priority,
    deadline: task.deadline?.slice(0, 10) ?? "", note: task.note ?? "",
    assigneeId: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  // จับคู่ผู้รับผิดชอบเดิมจากชื่อ (รายชื่ออาจโหลดมาทีหลังฟอร์ม) จนกว่าผู้ใช้จะเลือกเอง
  const [touched, setTouched] = useState(false);
  const matchedId = people.find((p) => p.name === task.assignee)?.id ?? "";
  const effective: FormState = touched ? f : { ...f, assigneeId: matchedId };
  const onChange = (n: FormState) => { if (n.assigneeId !== effective.assigneeId) setTouched(true); setF(n); };

  const save = async () => {
    if (!f.name.trim()) { setErr("กรุณาใส่ชื่องาน"); return; }
    setBusy(true); setErr("");
    const body: Record<string, unknown> = {
      name: f.name, status: f.status, category: f.category, priority: f.priority,
      deadline: f.deadline || null, note: f.note || "", done: f.status === "เสร็จแล้ว",
    };
    // ไม่แตะผู้รับผิดชอบ ถ้ายังไม่ได้เลือกเองและจับคู่คนเดิมไม่ได้ (กันลบคนเดิมโดยไม่ตั้งใจ)
    if (touched || matchedId || !task.assignee) body.assigneeId = effective.assigneeId || null;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setErr([data.error ?? "เชื่อมต่อไม่ได้", data.detail].filter(Boolean).join(" · ")); return; }
    onSaved(`บันทึกงาน “${f.name.trim()}” แล้ว`);
  };

  const del = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErr("ลบงานไม่สำเร็จ"); return; }
    onSaved(`ลบงาน “${task.name}” แล้ว`);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="แก้ไขงาน" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 26, padding: "22px 24px", width: "100%", maxWidth: 640, maxHeight: "92vh", overflow: "auto" }}>
        <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 500 }}>แก้ไขงาน</p>
        <Fields f={effective} setF={onChange} people={people} peopleErr={peopleErr} showStatus onEnter={save} />
        {err && <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "#A32D2D", background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 8, padding: "8px 10px" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={del} disabled={busy} style={{ fontSize: 13.5, padding: "9px 16px", borderRadius: 99, border: "0.5px solid #F7C1C1", background: confirmDel ? "#FCEBEB" : "transparent", color: "#791F1F", cursor: "pointer" }}>{confirmDel ? "ยืนยันลบงาน" : "ลบงาน"}</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ fontSize: 14, padding: "9px 18px", borderRadius: 99, border: "1px solid #EBD9D2", background: "#fff", color: "#7A6A64", cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={save} disabled={busy} style={{ fontSize: 14, padding: "9px 22px", borderRadius: 99, border: "none", background: "#C0200A", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: busy ? 0.6 : 1 }}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onToggleDone, onChangeStatus, onEdit }: {
  task: FrydayTask;
  onToggleDone: (id: string, done: boolean) => void;
  onChangeStatus: (id: string, status: TaskStatus) => void;
  onEdit: (task: FrydayTask) => void;
}) {
  const overdue = isOverdue(task.deadline, task.done);
  const cat = CATEGORY_STYLE[task.category] ?? CAT_FALLBACK;
  const pri = PRIORITY_STYLE[task.priority];
  const st = STATUS_CONFIG[task.status];
  const chip: React.CSSProperties = { fontSize: 11.5, padding: "2px 9px", borderRadius: 99, border: "1px solid", whiteSpace: "nowrap", lineHeight: 1.5 };
  return (
    <div style={{ background: "#fff", border: "1px solid #EBD9D2", borderLeft: `5px solid ${cat.bar}`, borderRadius: "6px 18px 18px 6px", opacity: task.done ? 0.55 : 1, transition: "opacity 0.2s", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px 10px" }}>
        <input type="checkbox" aria-label="ทำเสร็จแล้ว" checked={task.done} onChange={() => onToggleDone(task.id, !task.done)} style={{ marginTop: 3, width: 18, height: 18, flex: "none", cursor: "pointer", accentColor: "#C0200A" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...chip, border: "none", background: cat.bg, color: cat.color, fontWeight: 600, marginBottom: 5, display: "inline-block" }}>{task.category}</span>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, overflowWrap: "anywhere" }}>{task.name}</p>
          <div style={{ display: "flex", gap: "6px 8px", marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...chip, borderColor: "#EBD9D2", color: task.assignee ? "#2A0B07" : "#A89690", display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 4 }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 99, background: task.assignee ? cat.bar : "#D3D1C7", color: "#fff", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{task.assignee ? task.assignee.trim().charAt(0).toUpperCase() : "?"}</span>
              {task.assignee ?? "ยังไม่มอบหมาย"}
            </span>
            {task.deadline && (
              <span style={{ ...chip, borderColor: overdue ? "#F5C0B8" : "#EBD9D2", background: overdue ? "#FDE8E4" : "#FBF4F0", color: overdue ? "#B3200A" : "#5F504A", fontWeight: overdue ? 600 : 400 }}>
                {overdue ? "เกินกำหนด " : "กำหนด "}{formatDate(task.deadline)}
              </span>
            )}
            {pri && <span style={{ ...chip, color: pri.color, background: pri.bg, borderColor: pri.border, fontWeight: 500 }}>{task.priority}</span>}
          </div>
          {task.note && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#5a5950", lineHeight: 1.5, overflowWrap: "anywhere", background: "#FBF4F0", border: "1px solid #F3E3DD", borderRadius: 10, padding: "6px 10px" }}>{task.note}</p>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderTop: "1px solid #F3E3DD", background: "#FBF4F0" }}>
        <span style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Dot color={st.dot} /></span>
          <select
            aria-label="เปลี่ยนสถานะ"
            value={task.status}
            onChange={(e) => onChangeStatus(task.id, e.target.value as TaskStatus)}
            style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 12.5, padding: "6px 8px 6px 26px", borderRadius: 99, border: `1px solid ${st.border}`, background: st.bg, color: st.color, cursor: "pointer", fontWeight: 500 }}
          >
            {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </span>
        <button onClick={() => onEdit(task)} aria-label={`แก้ไขงาน ${task.name}`} style={{ flex: "none", font: "inherit", fontSize: 12.5, padding: "6px 14px", borderRadius: 99, border: "1px solid #EBD9D2", background: "#fff", color: "#2A0B07", cursor: "pointer", fontWeight: 500 }}>แก้ไข</button>
      </div>
    </div>
  );
}

function Column({ status, tasks, onToggleDone, onChangeStatus, onEdit }: {
  status: TaskStatus; tasks: FrydayTask[];
  onToggleDone: (id: string, done: boolean) => void;
  onChangeStatus: (id: string, status: TaskStatus) => void;
  onEdit: (task: FrydayTask) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <section aria-label={cfg.label} style={{ background: cfg.bg + "99", border: `1px solid ${cfg.border}`, borderRadius: 24, padding: 12, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px 6px" }}>
        <Dot color={cfg.dot} size={10} />
        <span style={{ fontSize: 14, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        <span style={{ fontSize: 12, color: cfg.color, marginLeft: "auto", background: "#fff", border: `1px solid ${cfg.border}`, borderRadius: 99, padding: "1px 10px", fontWeight: 500 }}>{tasks.length}</span>
      </div>
      {tasks.length === 0
        ? <p style={{ textAlign: "center", fontSize: 12.5, color: "#8a877b", margin: 0, padding: "28px 0", border: `1px dashed ${cfg.border}`, borderRadius: 10, background: "#ffffff99" }}>ไม่มีงาน</p>
        : tasks.map((t) => <TaskCard key={t.id} task={t} onToggleDone={onToggleDone} onChangeStatus={onChangeStatus} onEdit={onEdit} />)
      }
    </section>
  );
}

function AddTaskForm({ people, peopleErr, onClose, onAdded }: { people: Person[]; peopleErr: string; onClose: () => void; onAdded: (name: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [added, setAdded] = useState("");
  const [f, setF] = useState<FormState>({ name: "", status: "รอดำเนินการ", category: "การตลาด", priority: "ปานกลาง", deadline: "", note: "", assigneeId: "" });

  const submit = async () => {
    if (!f.name.trim()) { setErr("กรุณาใส่ชื่องาน"); return; }
    setBusy(true); setErr(""); setAdded("");
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, category: f.category, priority: f.priority, deadline: f.deadline || undefined, note: f.note || undefined, assigneeId: f.assigneeId || undefined, status: "รอดำเนินการ" }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setErr([data.error ?? "เชื่อมต่อไม่ได้", data.detail].filter(Boolean).join(" · ")); return; }
    const name = f.name.trim();
    setAdded(name);
    setF((x) => ({ ...x, name: "", note: "", deadline: "" }));
    onAdded(name);
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #EBD9D2", borderRadius: 24, padding: "18px 20px", marginBottom: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>เพิ่มงานใหม่</p>
      <Fields f={f} setF={setF} people={people} peopleErr={peopleErr} showStatus={false} onEnter={submit} />
      {err && <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "#A32D2D", background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 8, padding: "8px 10px" }}>{err}</p>}
      {added && <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "#1F5A2E", background: "#E3F1E6", border: "1px solid #B9D9C0", borderRadius: 8, padding: "8px 10px" }}>เพิ่มงาน “{added}” แล้ว กรอกต่อเพื่อเพิ่มงานถัดไปได้</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={submit} disabled={busy} style={{ fontSize: 14, padding: "9px 22px", borderRadius: 99, border: "none", background: "#C0200A", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: busy ? 0.6 : 1 }}>{busy ? "กำลังบันทึก…" : "บันทึกงาน"}</button>
        <button onClick={onClose} style={{ fontSize: 14, padding: "9px 18px", borderRadius: 99, border: "1px solid #EBD9D2", background: "#fff", color: "#7A6A64", cursor: "pointer" }}>ปิด</button>
      </div>
    </div>
  );
}

const LAYOUT_CSS = `
.tk-board{display:grid;gap:12px;align-items:start;grid-template-columns:repeat(4,minmax(0,1fr))}
.tk-board.one{grid-template-columns:minmax(0,640px)}
.tk-stats{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}
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
  const [editing, setEditing] = useState<FrydayTask | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleErr, setPeopleErr] = useState("");

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

  useEffect(() => { queueMicrotask(fetchTasks); }, [fetchTasks]);

  useEffect(() => {
    let off = false;
    fetch("/api/users").then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (off) return;
      if (r.ok) setPeople(d.people ?? []);
      else setPeopleErr([d.error, d.detail].filter(Boolean).join(" · ") || "ดึงรายชื่อไม่ได้");
    }).catch(() => { if (!off) setPeopleErr("ดึงรายชื่อผู้รับผิดชอบไม่ได้"); });
    return () => { off = true; };
  }, []);

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

  const pill = (active: boolean): React.CSSProperties => ({ fontSize: 12.5, padding: "7px 14px", borderRadius: 99, border: `1px solid ${active ? "#2A0B07" : "#EBD9D2"}`, background: active ? "#2A0B07" : "#fff", color: active ? "#fff" : "#7A6A64", cursor: "pointer", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" });
  const openCount = tasks.filter((t) => t.status !== "เสร็จแล้ว").length;
  const lateCount = tasks.filter((t) => isOverdue(t.deadline, t.done)).length;

  return (
    <main className="bn" style={{ maxWidth: 1280 }}>
      <style>{LAYOUT_CSS}</style>
      <section className="bn-hero">
        <div>
          <h1>งานของร้าน Fryday</h1>
          <p>ติดตามงานของทีมตามสถานะ เปลี่ยนสถานะและแก้ไขได้จากการ์ด</p>
        </div>
        <div className="bn-hero-side">
          {!loading && <div className="bn-kpi"><b>{openCount}</b><span>งานคงค้าง</span></div>}
          {!loading && <div className="bn-kpi"><b style={{ color: lateCount ? "#FFC27A" : undefined }}>{lateCount}</b><span>เกินกำหนด</span></div>}
          <button onClick={() => { setAdding((v) => !v); setNotice(""); }} aria-expanded={adding} className="bn-btn coral">{adding ? "ปิดฟอร์ม" : "+ เพิ่มงาน"}</button>
        </div>
      </section>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", ...allStatuses] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} style={{ ...pill(filter === s), display: "inline-flex", alignItems: "center", gap: 6 }}>{s !== "all" && <Dot color={filter === s ? "#fff" : STATUS_CONFIG[s].dot} size={7} />}{s === "all" ? "ทุกสถานะ" : STATUS_CONFIG[s].label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => setShowDone((v) => !v)} style={pill(showDone)}>{showDone ? "ซ่อนงานเสร็จ" : "แสดงงานเสร็จ"}</button>
        <button onClick={fetchTasks} style={pill(false)}>รีเฟรช</button>
      </div>

      {adding && <AddTaskForm people={people} peopleErr={peopleErr} onClose={() => setAdding(false)} onAdded={(name) => { setNotice(`เพิ่มงาน “${name}” แล้ว`); setFilter("all"); fetchTasks(); }} />}
      {notice && !adding && (() => { const ok = notice.startsWith("เพิ่ม") || notice.startsWith("บันทึกงาน") || notice.startsWith("ลบงาน"); return <p role="status" style={{ margin: 0, fontSize: 13, color: ok ? "#1F5A2E" : "#B3200A", background: ok ? "#E3F1E6" : "#FDE8E4", border: `1px solid ${ok ? "#B9D9C0" : "#F5C0B8"}`, borderRadius: 14, padding: "9px 14px" }}>{notice}</p>; })()}

      {loading && <p className="bn-empty">กำลังโหลด...</p>}
      {error   && <p role="alert" className="bn-err">{error}</p>}

      {!loading && !error && (
        <>
          <div className="tk-stats">
            {allStatuses.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <div key={s} style={{ background: "#fff", border: "1px solid #EBD9D2", borderRadius: 20, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#7A6A64" }}><Dot color={cfg.dot} size={8} />{cfg.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2, color: "#2A0B07" }}>{byStatus(s).length}</div>
                </div>
              );
            })}
            <div style={{ background: "#2A0B07", borderRadius: 20, padding: "12px 16px", color: "#fff" }}>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)" }}>งานทั้งหมด</div>
              <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{tasks.length}</div>
            </div>
          </div>
          <div className={filter === "all" ? "tk-board" : "tk-board one"}>
            {(filter === "all" ? allStatuses : [filter as TaskStatus]).map((s) => (
              <Column key={s} status={s} tasks={byStatus(s)} onToggleDone={handleToggleDone} onChangeStatus={handleChangeStatus} onEdit={setEditing} />
            ))}
          </div>
        </>
      )}
      {editing && <EditModal key={editing.id} task={editing} people={people} peopleErr={peopleErr} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setNotice(msg); fetchTasks(); }} />}
    </main>
  );
}
