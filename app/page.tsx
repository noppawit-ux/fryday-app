"use client";

import { useEffect, useState } from "react";

interface Task { id: string; name: string; status: string; priority: string; deadline: string | null; assignee: string | null; done: boolean; }
interface Summary { totalRevenue: number; totalExpense: number; netProfit: number; sharePerPerson: number; }
interface Campaign { id: string; title: string; status: string; postDate: string | null; channels: string[]; }

const PRIORITY_COLOR: Record<string, string> = { ด่วนมาก: "#D85A30", ปานกลาง: "#CB8A1A", ไม่เร่งด่วน: "#1D9E75" };
const STATUS_BG: Record<string, { bg: string; color: string }> = {
  รอดำเนินการ: { bg: "#E6F1FB", color: "#185FA5" },
  กำลังทำ:    { bg: "#FAEEDA", color: "#854F0B" },
  เสร็จแล้ว:  { bg: "#EAF3DE", color: "#27500A" },
  ติดปัญหา:   { bg: "#FCEBEB", color: "#791F1F" },
};

function formatBaht(n: number) { return new Intl.NumberFormat("th-TH").format(Math.round(n)); }
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
function isOverdue(d: string | null) { return d ? new Date(d) < new Date() : false; }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "อรุณสวัสดิ์ 🌅";
  if (h < 17) return "สวัสดีตอนบ่าย ☀️";
  return "สวัสดีตอนเย็น 🌙";
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

  const overdueCount = tasks.filter((t) => isOverdue(t.deadline)).length;
  const recentTasks  = tasks.slice(0, 5);
  const upcomingMkt  = campaigns.filter((c) => c.postDate && c.status !== "โพสต์แล้ว").sort((a, b) => (a.postDate ?? "").localeCompare(b.postDate ?? "")).slice(0, 3);
  const today = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 32px" }}>

        {/* Hero */}
        <div style={{ background: "linear-gradient(135deg, #1D9E75 0%, #185FA5 100%)", borderRadius: 16, padding: "20px", marginBottom: 16, color: "#fff" }}>
          <p style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700 }}>{getGreeting()}</p>
          <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.8 }}>{today}</p>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "งานคงค้าง", value: tasks.length, warn: false },
              { label: "เกิน Deadline", value: overdueCount, warn: overdueCount > 0 },
              { label: "โพสต์เดือนนี้", value: campaigns.filter(c => c.status === "โพสต์แล้ว").length, warn: false },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.18)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: s.warn ? "#FFD166" : "#fff" }}>{s.value}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.85 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick nav grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { href: "/tasks",     icon: "📋", label: "จัดการงาน",  bg: "#E6F1FB", color: "#185FA5", border: "#B5D4F4" },
            { href: "/finance",   icon: "💰", label: "ดูการเงิน",  bg: "#EAF3DE", color: "#27500A", border: "#C0DD97" },
            { href: "/marketing", icon: "📣", label: "Marketing",   bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6" },
            { href: "/calendar",  icon: "🗓", label: "ปฏิทิน",     bg: "#FAEEDA", color: "#854F0B", border: "#FAC775" },
            { href: "/files",     icon: "📁", label: "ไฟล์งาน",    bg: "#F1EFE8", color: "#5F5E5A", border: "#D3D1C7" },
          ].map((q) => (
            <a key={q.href} href={q.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px", borderRadius: 12, textDecoration: "none",
              background: q.bg, border: `0.5px solid ${q.border}`,
              color: q.color, fontSize: 14, fontWeight: 500,
            }}>
              <span style={{ fontSize: 22 }}>{q.icon}</span>
              <span>{q.label}</span>
            </a>
          ))}
        </div>

        {/* Finance Summary */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 16, border: "0.5px solid #e5e3db" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a18" }}>💰 การเงินเดือนนี้</p>
            <a href="/finance" style={{ fontSize: 12, color: "#73726c", textDecoration: "none" }}>ดูทั้งหมด →</a>
          </div>
          {loading || !summary ? (
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>กำลังโหลด...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "รายรับ",    value: summary.totalRevenue,   color: "#1D9E75", bg: "#EAF3DE" },
                { label: "รายจ่าย",  value: summary.totalExpense,   color: "#D85A30", bg: "#FCEBEB" },
                { label: "กำไรสุทธิ", value: summary.netProfit,     color: summary.netProfit >= 0 ? "#185FA5" : "#A32D2D", bg: summary.netProfit >= 0 ? "#E6F1FB" : "#FCEBEB" },
                { label: "ส่วนแบ่ง/คน", value: summary.sharePerPerson, color: "#534AB7", bg: "#EEEDFE" },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 11, color: s.color, opacity: 0.8 }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: s.color }}>฿{formatBaht(s.value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 16, border: "0.5px solid #e5e3db" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a18" }}>📋 งานล่าสุด</p>
            <a href="/tasks" style={{ fontSize: 12, color: "#73726c", textDecoration: "none" }}>ดูทั้งหมด ({tasks.length}) →</a>
          </div>
          {loading ? <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>กำลังโหลด...</p>
          : recentTasks.length === 0
            ? <p style={{ fontSize: 13, color: "#aaa", margin: 0, textAlign: "center", padding: "12px 0" }}>ไม่มีงานค้างอยู่ 🎉</p>
            : recentTasks.map((t, i) => {
              const overdue = isOverdue(t.deadline);
              const st = STATUS_BG[t.status] ?? { bg: "#f1efe8", color: "#73726c" };
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid #f1efe8" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[t.priority] ?? "#ccc", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 4, background: st.bg, color: st.color }}>{t.status}</span>
                      {t.deadline && <span style={{ fontSize: 11, color: overdue ? "#D85A30" : "#73726c" }}>{overdue ? "⚠️ " : "📅 "}{formatDate(t.deadline)}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* Marketing */}
        {upcomingMkt.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "0.5px solid #e5e3db" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a18" }}>📣 แผนโพสต์ที่รอดำเนินการ</p>
              <a href="/marketing" style={{ fontSize: 12, color: "#73726c", textDecoration: "none" }}>ดูทั้งหมด →</a>
            </div>
            {upcomingMkt.map((c, i) => (
              <div key={c.id} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid #f1efe8" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📣 {c.title}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 4, background: "#EEEDFE", color: "#3C3489" }}>{c.status}</span>
                  {c.postDate && <span style={{ fontSize: 11, color: "#73726c" }}>📅 {formatDate(c.postDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        @media (max-width: 640px) {
          main { padding: 12px 12px 80px !important; }
        }
      `}</style>
    </>
  );
}