"use client";

import { useEffect, useState } from "react";

// ---- Types ----
interface Task { id: string; name: string; status: string; priority: string; deadline: string | null; assignee: string | null; category: string; done: boolean; }
interface Summary { totalRevenue: number; totalExpense: number; netProfit: number; sharePerPerson: number; }
interface Campaign { id: string; title: string; status: string; postDate: string | null; channels: string[]; }

const PRIORITY_COLOR: Record<string, string> = { ด่วนมาก: "#D85A30", ปานกลาง: "#CB8A1A", ไม่เร่งด่วน: "#1D9E75" };
const STATUS_BG: Record<string, { bg: string; color: string }> = {
  รอดำเนินการ: { bg: "#E6F1FB", color: "#185FA5" },
  กำลังทำ:    { bg: "#FAEEDA", color: "#854F0B" },
  เสร็จแล้ว:  { bg: "#EAF3DE", color: "#27500A" },
  ติดปัญหา:   { bg: "#FCEBEB", color: "#791F1F" },
};
const MKT_STATUS_BG: Record<string, { bg: string; color: string }> = {
  ไอเดีย:     { bg: "#F1EFE8", color: "#5F5E5A" },
  กำลังสร้าง: { bg: "#FAEEDA", color: "#854F0B" },
  รออนุมัติ:  { bg: "#E6F1FB", color: "#185FA5" },
  โพสต์แล้ว: { bg: "#EAF3DE", color: "#27500A" },
  วัดผล:      { bg: "#EEEDFE", color: "#3C3489" },
};

function formatBaht(n: number) {
  return new Intl.NumberFormat("th-TH").format(Math.round(n));
}
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
function isOverdue(d: string | null) {
  return d ? new Date(d) < new Date() : false;
}

// ---- Greeting ----
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "อรุณสวัสดิ์ 🌅";
  if (h < 17) return "สวัสดีตอนบ่าย ☀️";
  return "สวัสดีตอนเย็น 🌙";
}

// ---- Section Header ----
function SectionHeader({ icon, title, href, count }: { icon: string; title: string; href: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 500, color: "#1a1a18" }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "#f1efe8", color: "#73726c", marginLeft: 2 }}>
          {count}
        </span>
      )}
      <a href={href} style={{ marginLeft: "auto", fontSize: 12, color: "#73726c", textDecoration: "none", padding: "4px 10px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "#fff" }}>
        ดูทั้งหมด →
      </a>
    </div>
  );
}

export default function HomePage() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);

  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [tRes, fRes, mRes] = await Promise.all([
          fetch("/api/tasks?done=false"),
          fetch(`/api/finance?month=${month}`),
          fetch("/api/marketing"),
        ]);
        if (tRes.ok) { const d = await tRes.json(); setTasks(d.tasks ?? []); }
        if (fRes.ok) { const d = await fRes.json(); setSummary(d.summary); }
        if (mRes.ok) { const d = await mRes.json(); setCampaigns(d.campaigns ?? []); }
      } finally { setLoading(false); }
    }
    fetchAll();
  }, [month]);

  // derived
  const urgentTasks   = tasks.filter((t) => t.priority === "ด่วนมาก").slice(0, 5);
  const recentTasks   = tasks.slice(0, 5);
  const upcomingMkt   = campaigns.filter((c) => c.postDate && c.status !== "โพสต์แล้ว").sort((a, b) => (a.postDate ?? "").localeCompare(b.postDate ?? "")).slice(0, 4);
  const taskByStatus  = { รอดำเนินการ: 0, กำลังทำ: 0, เสร็จแล้ว: 0, ติดปัญหา: 0 } as Record<string, number>;
  tasks.forEach((t) => { if (taskByStatus[t.status] !== undefined) taskByStatus[t.status]++; });
  const overdueCount  = tasks.filter((t) => isOverdue(t.deadline)).length;

  const today = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>

      {/* Hero */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: "0.5px solid #e5e3db" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 600, color: "#1a1a18" }}>{getGreeting()}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#73726c" }}>{today}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {overdueCount > 0 && (
              <div style={{ background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#791F1F" }}>{overdueCount}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#791F1F" }}>งานเกิน Deadline</p>
              </div>
            )}
            <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#854F0B" }}>{tasks.length}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#854F0B" }}>งานคงค้าง</p>
            </div>
            <div style={{ background: "#EAF3DE", border: "0.5px solid #C0DD97", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#27500A" }}>{campaigns.filter(c => c.status === "โพสต์แล้ว").length}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#27500A" }}>โพสต์เดือนนี้</p>
            </div>
          </div>
        </div>

        {/* Quick nav */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { href: "/tasks",     icon: "📋", label: "จัดการงาน",  bg: "#E6F1FB", color: "#185FA5" },
            { href: "/finance",   icon: "💰", label: "ดูการเงิน",  bg: "#EAF3DE", color: "#27500A" },
            { href: "/marketing", icon: "📣", label: "Marketing",   bg: "#EEEDFE", color: "#3C3489" },
            { href: "/calendar",  icon: "🗓", label: "ปฏิทิน",     bg: "#FAEEDA", color: "#854F0B" },
          ].map((q) => (
            <a key={q.href} href={q.href} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10, textDecoration: "none",
              background: q.bg, color: q.color, fontSize: 13, fontWeight: 500,
              border: "0.5px solid transparent", transition: "opacity 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <span>{q.icon}</span>{q.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Finance Summary */}
        <div style={{ gridColumn: "1/-1", background: "#fff", borderRadius: 14, padding: "18px 20px", border: "0.5px solid #e5e3db" }}>
          <SectionHeader icon="💰" title={`การเงิน — ${new Date().toLocaleDateString("th-TH", { month: "long", year: "numeric" })}`} href="/finance" />
          {loading || !summary ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>กำลังโหลด...</p>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "รายรับ",    value: summary.totalRevenue,   color: "#1D9E75", bg: "#EAF3DE" },
                { label: "รายจ่าย",  value: summary.totalExpense,   color: "#D85A30", bg: "#FCEBEB" },
                { label: "กำไรสุทธิ", value: summary.netProfit,     color: summary.netProfit >= 0 ? "#185FA5" : "#A32D2D", bg: summary.netProfit >= 0 ? "#E6F1FB" : "#FCEBEB" },
                { label: "ส่วนแบ่ง/คน", value: summary.sharePerPerson, color: "#534AB7", bg: "#EEEDFE" },
              ].map((s) => (
                <div key={s.label} style={{ flex: "1 1 160px", background: s.bg, borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ margin: "0 0 3px", fontSize: 12, color: s.color, opacity: 0.8 }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: s.color }}>฿{formatBaht(s.value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "0.5px solid #e5e3db" }}>
          <SectionHeader icon="📋" title="งานทั้งหมด" href="/tasks" count={tasks.length} />

          {/* Status summary pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {Object.entries(taskByStatus).map(([s, n]) => {
              const st = STATUS_BG[s] ?? { bg: "#f1efe8", color: "#73726c" };
              return (
                <div key={s} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: st.bg, color: st.color, fontWeight: 500 }}>
                  {n} {s}
                </div>
              );
            })}
          </div>

          {/* Task list */}
          {loading ? <p style={{ fontSize: 13, color: "#aaa" }}>กำลังโหลด...</p> : (
            recentTasks.length === 0
              ? <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>ไม่มีงานค้างอยู่ 🎉</p>
              : recentTasks.map((t) => {
                const overdue = isOverdue(t.deadline);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderTop: "0.5px solid #f1efe8" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[t.priority] ?? "#ccc", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: STATUS_BG[t.status]?.bg ?? "#f1efe8", color: STATUS_BG[t.status]?.color ?? "#73726c" }}>{t.status}</span>
                        {t.deadline && <span style={{ fontSize: 11, color: overdue ? "#D85A30" : "#73726c" }}>{overdue ? "⚠️ " : ""}{formatDate(t.deadline)}</span>}
                        {t.assignee && <span style={{ fontSize: 11, color: "#73726c" }}>👤 {t.assignee}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Marketing */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "0.5px solid #e5e3db" }}>
          <SectionHeader icon="📣" title="Marketing" href="/marketing" count={campaigns.length} />

          {loading ? <p style={{ fontSize: 13, color: "#aaa" }}>กำลังโหลด...</p> : (
            upcomingMkt.length === 0
              ? <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>ไม่มีแผนโพสต์ที่รอดำเนินการ</p>
              : upcomingMkt.map((c) => {
                const st = MKT_STATUS_BG[c.status] ?? { bg: "#f1efe8", color: "#73726c" };
                return (
                  <div key={c.id} style={{ padding: "8px 0", borderTop: "0.5px solid #f1efe8" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 16, marginTop: 1 }}>📣</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
                        <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: st.bg, color: st.color }}>{c.status}</span>
                          {c.postDate && <span style={{ fontSize: 11, color: "#73726c" }}>📅 {formatDate(c.postDate)}</span>}
                          {c.channels.slice(0, 2).map((ch) => (
                            <span key={ch} style={{ fontSize: 11, color: "#3C3489", background: "#EEEDFE", padding: "1px 6px", borderRadius: 4 }}>{ch}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

      </div>
    </main>
  );
}