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
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 10, padding: "12px 14px", marginBottom: 8, opacity: task.done ? 0.55 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <input type="checkbox" checked={task.done} onChange={() => onToggleDone(task.id, !task.done)} style={{ marginTop: 2, cursor: "pointer", accentColor: "#1D9E75" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4 }}>
            {CATEGORY_BADGE[task.category] ?? "📋"} {task.name}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
            {task.assignee && <span style={{ fontSize: 11, color: "#73726c" }}>👤 {task.assignee}</span>}
            {task.deadline && <span style={{ fontSize: 11, color: overdue ? "#A32D2D" : "#73726c", fontWeight: overdue ? 500 : 400 }}>{overdue ? "⚠️" : "📅"} {formatDate(task.deadline)}</span>}
            <span style={{ fontSize: 11, color: "#73726c" }}>{PRIORITY_BADGE[task.priority]} {task.priority}</span>
          </div>
          {task.note && <p style={{ margin: "5px 0 0", fontSize: 12, color: "#73726c", lineHeight: 1.5 }}>{task.note}</p>}
        </div>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => {
          const c = STATUS_CONFIG[s];
          const active = task.status === s;
          return (
            <button key={s} onClick={() => onChangeStatus(task.id, s)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, border: `0.5px solid ${active ? c.border : "#e5e3db"}`, background: active ? c.bg : "transparent", color: active ? c.color : "#73726c", cursor: "pointer", fontWeight: active ? 500 : 400 }}>
              {c.label}
            </button>
          );
        })}
      </div>
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
    <div style={{ background: "#f6f5f0", borderRadius: 12, padding: "12px 10px", minWidth: 260, flex: "1 1 260px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "0 4px" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color, background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 99, padding: "2px 10px" }}>{cfg.label}</span>
        <span style={{ fontSize: 11, color: "#73726c", marginLeft: "auto" }}>{tasks.length} งาน</span>
      </div>
      {tasks.length === 0
        ? <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", padding: "24px 0" }}>ไม่มีงาน</p>
        : tasks.map((t) => <TaskCard key={t.id} task={t} onToggleDone={onToggleDone} onChangeStatus={onChangeStatus} />)
      }
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<FrydayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [showDone, setShowDone] = useState(false);

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
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done, status: done ? "เสร็จแล้ว" : undefined }) });
  };

  const handleChangeStatus = async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  };

  const allStatuses = Object.keys(STATUS_CONFIG) as TaskStatus[];
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);

  return (
    <main style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>🍗 Fryday — Task Manager</h1>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          {(["all", ...allStatuses] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 99, border: `0.5px solid ${filter === s ? "#1D9E75" : "#e5e3db"}`, background: filter === s ? "#EAF3DE" : "transparent", color: filter === s ? "#27500A" : "#73726c", cursor: "pointer", fontWeight: filter === s ? 500 : 400 }}>
              {s === "all" ? "ทุกสถานะ" : STATUS_CONFIG[s].label}
            </button>
          ))}
          <button onClick={() => setShowDone((v) => !v)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 99, border: `0.5px solid ${showDone ? "#534AB7" : "#e5e3db"}`, background: showDone ? "#EEEDFE" : "transparent", color: showDone ? "#3C3489" : "#73726c", cursor: "pointer" }}>
            {showDone ? "ซ่อนงานเสร็จ" : "แสดงงานเสร็จ"}
          </button>
          <button onClick={fetchTasks} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 99, border: "0.5px solid #e5e3db", background: "transparent", color: "#73726c", cursor: "pointer" }}>🔄 รีเฟรช</button>
        </div>
      </div>

      {loading && <p style={{ color: "#73726c", fontSize: 14 }}>กำลังโหลด...</p>}
      {error   && <p style={{ color: "#A32D2D", fontSize: 14 }}>❌ {error}</p>}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {allStatuses.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return <div key={s} style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, color: cfg.color, fontWeight: 500 }}>{byStatus(s).length} {cfg.label.replace(/^[^\s]+\s/, "")}</div>;
            })}
            <div style={{ background: "#f6f5f0", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#73726c" }}>รวม {tasks.length} งาน</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            {(filter === "all" ? allStatuses : [filter as TaskStatus]).map((s) => (
              <Column key={s} status={s} tasks={byStatus(s)} onToggleDone={handleToggleDone} onChangeStatus={handleChangeStatus} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}