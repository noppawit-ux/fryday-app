"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import SalesPanel from "./sales-panel";
import { salesSignals, type Snapshot } from "@/lib/roadmap-sales";

type Area = "system" | "sales" | "cost" | "people";
type Status = "todo" | "doing" | "done";
interface Phase { id: string; name: string; goal: string; area: Area; start_date: string; end_date: string; sort_order: number }
interface Task { id: string; title: string; phase_id: string; area: Area; status: Status; due: string | null; note: string; sort_order: number }

const RED = "#C0200A", MUTED = "#73726c", LINE = "#e5e3db";
const AREA: Record<Area, { label: string; color: string }> = {
  system: { label: "ระบบ", color: "#2B6CB0" },
  sales: { label: "ยอดขาย", color: "#0F8A9D" },
  cost: { label: "ต้นทุน", color: "#C0200A" },
  people: { label: "คน", color: "#7C5CD6" },
};
const STATUS: Record<Status, { label: string; icon: string; next: Status }> = {
  todo: { label: "ยังไม่ทำ", icon: "○", next: "doing" },
  doing: { label: "กำลังทำ", icon: "◐", next: "done" },
  done: { label: "เสร็จแล้ว", icon: "●", next: "todo" },
};

const card: CSSProperties = { background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 12, padding: 16 };
const input: CSSProperties = { font: "inherit", fontSize: 14, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%", background: "#fff" };
const btn: CSSProperties = { font: "inherit", fontSize: 14, padding: "6px 12px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", cursor: "pointer" };
const btnPrimary: CSSProperties = { ...btn, background: RED, color: "#fff", borderColor: RED, fontWeight: 600 };

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // วันที่ตามเวลาไทย
const fmt = (iso: string | null) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const fetchPlan = () => api<{ phases: Phase[]; tasks: Task[] }>("/api/roadmap");
const fetchSales = () => api<{ snapshot: Snapshot; fetchedAt: number }>("/api/roadmap/sales");

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { status, data } = await api<object>("/api/roadmap/login", { method: "POST", body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (status === 200) onDone(); else setErr(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
  }
  return (
    <main style={{ maxWidth: 380, margin: "60px auto", padding: "0 16px" }}>
      <form onSubmit={submit} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Roadmap ร้าน Fryday</h1>
        <p style={{ margin: 0, fontSize: 14, color: MUTED }}>หน้านี้มีตัวเลขยอดขายและกำไร ใส่รหัสผ่านเพื่อเข้า</p>
        <input type="password" autoFocus aria-label="รหัสผ่าน" placeholder="รหัสผ่าน" value={pw} onChange={(e) => setPw(e.target.value)} style={input} />
        {err && <p role="alert" style={{ margin: 0, color: RED, fontSize: 14 }}>{err}</p>}
        <button type="submit" disabled={busy || !pw} style={{ ...btnPrimary, opacity: busy || !pw ? 0.6 : 1 }}>{busy ? "กำลังตรวจ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: MUTED }}>{label}{children}</label>
);

function TaskModal({ task, phases, defaultPhase, onClose, onSaved }: { task: Task | null; phases: Phase[]; defaultPhase: string; onClose: () => void; onSaved: () => void }) {
  const first = phases.find((p) => p.id === (task?.phase_id ?? defaultPhase)) ?? phases[0];
  const [f, setF] = useState({ title: task?.title ?? "", phaseId: task?.phase_id ?? first?.id ?? "", status: task?.status ?? "todo", due: task?.due ?? "", note: task?.note ?? "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [confirmDel, setConfirmDel] = useState(false);
  const area = phases.find((p) => p.id === f.phaseId)?.area ?? "system";
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { status, data } = await api<object>("/api/roadmap", { method: "POST", body: JSON.stringify({ action: "saveTask", data: { id: task?.id, ...f, area } }) });
    setBusy(false);
    if (status === 200) { onSaved(); onClose(); } else setErr(data.error ?? "บันทึกไม่สำเร็จ");
  }
  async function del() {
    if (!task) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true);
    const { status, data } = await api<object>("/api/roadmap", { method: "POST", body: JSON.stringify({ action: "deleteTask", data: { id: task.id } }) });
    setBusy(false);
    if (status === 200) { onSaved(); onClose(); } else setErr(data.error ?? "ลบไม่สำเร็จ");
  }
  return (
    <Modal title={task ? "แก้ไขงาน" : "เพิ่มงาน"} onClose={onClose}>
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="ชื่องาน"><input style={input} value={f.title} maxLength={140} autoFocus onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="เฟส"><select style={input} value={f.phaseId} onChange={(e) => setF({ ...f, phaseId: e.target.value })}>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="สถานะ"><select style={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}>{(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select></Field>
          <Field label="กำหนดเสร็จ"><input type="date" style={input} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        </div>
        <Field label="หมายเหตุ"><textarea style={{ ...input, minHeight: 70 }} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {err && <p role="alert" style={{ margin: 0, color: RED, fontSize: 14 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {task && <button type="button" onClick={del} disabled={busy} style={{ ...btn, color: RED }}>{confirmDel ? "ยืนยันลบงาน" : "ลบงาน"}</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={btn}>ยกเลิก</button>
          <button type="submit" disabled={busy || !f.title.trim()} style={btnPrimary}>บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}

function PhaseModal({ phase, onClose, onSaved }: { phase: Phase | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: phase?.name ?? "", goal: phase?.goal ?? "", area: phase?.area ?? ("system" as Area), start: phase?.start_date ?? today(), end: phase?.end_date ?? today() });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [confirmDel, setConfirmDel] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { status, data } = await api<object>("/api/roadmap", { method: "POST", body: JSON.stringify({ action: "savePhase", data: { id: phase?.id, ...f } }) });
    setBusy(false);
    if (status === 200) { onSaved(); onClose(); } else setErr(data.error ?? "บันทึกไม่สำเร็จ");
  }
  async function del() {
    if (!phase) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true);
    const { status, data } = await api<object>("/api/roadmap", { method: "POST", body: JSON.stringify({ action: "deletePhase", data: { id: phase.id } }) });
    setBusy(false);
    if (status === 200) { onSaved(); onClose(); } else setErr(data.error ?? "ลบไม่สำเร็จ");
  }
  return (
    <Modal title={phase ? "แก้ไขเฟส" : "เพิ่มเฟส"} onClose={onClose}>
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="ชื่อเฟส"><input style={input} value={f.name} maxLength={80} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="เป้าหมาย"><input style={input} value={f.goal} maxLength={200} onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
        <Field label="หมวด"><select style={input} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as Area })}>{(Object.keys(AREA) as Area[]).map((a) => <option key={a} value={a}>{AREA[a].label}</option>)}</select></Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="เริ่ม"><input type="date" style={input} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="จบ"><input type="date" style={input} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        </div>
        {confirmDel && <p style={{ margin: 0, fontSize: 13, color: RED }}>การลบเฟสจะลบงานทั้งหมดในเฟสนี้ด้วย กดอีกครั้งเพื่อยืนยัน</p>}
        {err && <p role="alert" style={{ margin: 0, color: RED, fontSize: 14 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          {phase && <button type="button" onClick={del} disabled={busy} style={{ ...btn, color: RED }}>{confirmDel ? "ยืนยันลบเฟส" : "ลบเฟส"}</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={btn}>ยกเลิก</button>
          <button type="submit" disabled={busy || !f.name.trim()} style={btnPrimary}>บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}

export default function RoadmapPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [sales, setSales] = useState<{ snapshot: Snapshot; fetchedAt: number } | null>(null);
  const [salesErr, setSalesErr] = useState("");
  const [salesBusy, setSalesBusy] = useState(false);
  const [taskModal, setTaskModal] = useState<{ task: Task | null; phase: string } | null>(null);
  const [phaseModal, setPhaseModal] = useState<{ phase: Phase | null } | null>(null);
  const [hideDone, setHideDone] = useState(false);

  type PlanRes = Awaited<ReturnType<typeof fetchPlan>>;
  type SalesRes = Awaited<ReturnType<typeof fetchSales>>;

  const applyPlan = useCallback(({ status, data }: PlanRes) => {
    if (status === 401) { setAuthed(false); return; }
    setAuthed(true);
    if (status === 200) { setPhases(data.phases); setTasks(data.tasks); setLoadErr(""); } else setLoadErr(data.error ?? "ดึงแผนไม่สำเร็จ");
  }, []);
  const applySales = useCallback(({ status, data }: SalesRes) => {
    setSalesBusy(false);
    if (status === 200) { setSales({ snapshot: data.snapshot, fetchedAt: data.fetchedAt }); setSalesErr(""); }
    else if (status === 401) setAuthed(false);
    else setSalesErr(data.error ?? "ดึงตัวเลขยอดขายไม่สำเร็จ");
  }, []);
  const loadPlan = useCallback(() => fetchPlan().then(applyPlan), [applyPlan]);
  const loadSales = useCallback(() => { setSalesBusy(true); return fetchSales().then(applySales); }, [applySales]);

  useEffect(() => {
    let off = false;
    void fetchPlan().then((r) => { if (!off) applyPlan(r); });
    return () => { off = true; };
  }, [applyPlan]);
  useEffect(() => {
    if (!authed) return;
    let off = false;
    void fetchSales().then((r) => { if (!off) applySales(r); });
    return () => { off = true; };
  }, [authed, applySales]);

  const signals = useMemo(() => {
    const out: { sev: "bad" | "warn" | "info"; text: string; n: number }[] = [];
    const t = today();
    const open = tasks.filter((x) => x.status !== "done");
    const over = open.filter((x) => x.due && x.due < t);
    if (over.length) out.push({ sev: "bad", n: 0, text: `งานเกินกำหนด ${over.length} งาน: ${over.slice(0, 2).map((x) => x.title).join(", ")}${over.length > 2 ? " …" : ""}` });
    const doing = tasks.filter((x) => x.status === "doing").length;
    if (doing > 5) out.push({ sev: "warn", n: 1, text: `กำลังทำพร้อมกัน ${doing} งาน ถ้าเกิน 3-5 งาน มักไม่มีงานไหนเสร็จจริง` });
    phases.forEach((p) => {
      const ts = tasks.filter((x) => x.phase_id === p.id);
      const dn = ts.filter((x) => x.status === "done").length;
      if (t >= p.start_date && t <= p.end_date) {
        const tp = Math.round(((days(p.start_date, t) + 1) / (days(p.start_date, p.end_date) + 1)) * 100);
        if (!ts.length) out.push({ sev: "warn", n: 1, text: `เฟส “${p.name}” กำลังดำเนินอยู่ แต่ยังไม่มีงานในเฟส` });
        else if (tp >= 50 && dn === 0) out.push({ sev: "warn", n: 1, text: `เฟส “${p.name}” ผ่านไป ${tp}% ของเวลา แต่ยังไม่มีงานเสร็จ` });
      } else if (t > p.end_date && dn < ts.length) out.push({ sev: "warn", n: 1, text: `เฟส “${p.name}” หมดเวลาแล้ว ยังเหลือ ${ts.length - dn} งาน` });
    });
    if (sales) salesSignals(sales.snapshot).forEach((s) => out.push({ sev: s.sev, n: s.sev === "warn" ? 1 : 2, text: s.text }));
    out.sort((a, b) => a.n - b.n);
    return out;
  }, [tasks, phases, sales]);

  async function setStatus(task: Task) {
    const next = STATUS[task.status].next;
    setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    const { status } = await api<object>("/api/roadmap", { method: "POST", body: JSON.stringify({ action: "setStatus", data: { id: task.id, status: next } }) });
    if (status !== 200) void loadPlan();
  }

  async function logout() {
    await api<object>("/api/roadmap/login", { method: "DELETE" });
    setPhases([]); setTasks([]); setSales(null); setAuthed(false);
  }

  if (authed === null) return <main style={{ padding: 24, color: MUTED }}>กำลังโหลด…</main>;
  if (!authed) return <Login onDone={() => void loadPlan()} />;

  const done = tasks.filter((x) => x.status === "done").length;
  const sevColor = { bad: RED, warn: "#b45309", info: "#2B6CB0" };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 60px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Roadmap ร้าน Fryday</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>เสร็จแล้ว {done} จาก {tasks.length} งาน</p>
        </div>
        <span style={{ flex: 1 }} />
        <button style={btn} onClick={() => setHideDone((v) => !v)}>{hideDone ? "แสดงงานที่เสร็จ" : "ซ่อนงานที่เสร็จ"}</button>
        <button style={btnPrimary} onClick={() => setPhaseModal({ phase: null })}>เพิ่มเฟส</button>
        <button style={btn} onClick={logout}>ออกจากระบบ</button>
      </div>

      {loadErr && <p role="alert" style={{ ...card, color: RED, margin: 0 }}>{loadErr}</p>}

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: 16 }}>สัญญาณจากข้อมูล</h2>
        {signals.length === 0 ? <p style={{ margin: "8px 0 0", fontSize: 14, color: MUTED }}>ยังไม่พบสัญญาณผิดปกติ</p> : (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {signals.map((s) => (
              <li key={s.text} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                <span style={{ flex: "none", width: 9, height: 9, borderRadius: "50%", background: sevColor[s.sev], marginTop: 7 }} />
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sales ? <SalesPanel snap={sales.snapshot} fetchedAt={sales.fetchedAt} onRefresh={() => void loadSales()} busy={salesBusy} /> : (
        <section style={card}>
          <h2 style={{ margin: 0, fontSize: 16 }}>ตัวเลขจริงจากระบบบัญชี</h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: salesErr ? RED : MUTED }}>{salesErr || "กำลังดึงข้อมูล…"}</p>
          {salesErr && <button style={{ ...btn, marginTop: 8 }} onClick={() => void loadSales()}>ลองอีกครั้ง</button>}
        </section>
      )}

      {phases.length === 0 && !loadErr && <p style={{ ...card, margin: 0, color: MUTED }}>ยังไม่มีเฟสในแผน กด “เพิ่มเฟส” เพื่อเริ่ม</p>}

      {phases.map((p) => {
        const all = tasks.filter((x) => x.phase_id === p.id);
        const shown = hideDone ? all.filter((x) => x.status !== "done") : all;
        const dn = all.filter((x) => x.status === "done").length;
        const pct = all.length ? Math.round((dn / all.length) * 100) : 0;
        return (
          <section key={p.id} style={{ ...card, borderLeft: `4px solid ${AREA[p.area].color}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{p.name}</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{fmt(p.start_date)} – {fmt(p.end_date)} · {AREA[p.area].label} · {dn}/{all.length} งาน ({pct}%)</p>
                {p.goal && <p style={{ margin: "4px 0 0", fontSize: 14 }}>เป้าหมาย: {p.goal}</p>}
              </div>
              <span style={{ flex: 1 }} />
              <button style={btn} onClick={() => setPhaseModal({ phase: p })}>แก้ไขเฟส</button>
              <button style={btn} onClick={() => setTaskModal({ task: null, phase: p.id })}>เพิ่มงาน</button>
            </div>
            <div style={{ height: 6, background: "#f1efe8", borderRadius: 99, margin: "10px 0" }}><div style={{ width: `${pct}%`, height: "100%", background: AREA[p.area].color, borderRadius: 99 }} /></div>
            {shown.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: MUTED }}>{all.length ? "งานทั้งหมดเสร็จแล้ว" : "ยังไม่มีงานในเฟสนี้"}</p> : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {shown.map((x) => {
                  const late = x.status !== "done" && x.due && x.due < today();
                  return (
                    <li key={x.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: `0.5px solid ${LINE}` }}>
                      <button aria-label={`สถานะ: ${STATUS[x.status].label} กดเพื่อเปลี่ยน`} title={STATUS[x.status].label} onClick={() => void setStatus(x)} style={{ ...btn, padding: "0 8px", minWidth: 34, minHeight: 34, fontSize: 18, color: AREA[x.area].color }}>{STATUS[x.status].icon}</button>
                      <button onClick={() => setTaskModal({ task: x, phase: p.id })} style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14.5, textDecoration: x.status === "done" ? "line-through" : "none", color: x.status === "done" ? MUTED : "#1a1a18", overflowWrap: "anywhere" }}>{x.title}</span>
                        <span style={{ display: "block", fontSize: 12, color: late ? RED : MUTED }}>{x.due ? `กำหนด ${fmt(x.due)}${late ? " (เกินกำหนด)" : ""}` : "ไม่มีกำหนด"}{x.note ? ` · ${x.note}` : ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {taskModal && <TaskModal task={taskModal.task} phases={phases} defaultPhase={taskModal.phase} onClose={() => setTaskModal(null)} onSaved={() => void loadPlan()} />}
      {phaseModal && <PhaseModal phase={phaseModal.phase} onClose={() => setPhaseModal(null)} onSaved={() => void loadPlan()} />}
    </main>
  );
}
