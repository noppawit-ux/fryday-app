"use client";

import { useEffect, useState } from "react";

interface Task { id: string; name: string; status: string; priority: string; deadline: string | null; assignee: string | null; done: boolean; }
interface Summary { totalRevenue: number; totalExpense: number; netProfit: number; sharePerPerson: number; }
interface Campaign { id: string; title: string; status: string; postDate: string | null; channels: string[]; }

const STATUS_BG: Record<string, { bg: string; color: string }> = {
  รอดำเนินการ: { bg: "#FEE9E7", color: "#C0200A" },
  กำลังทำ:    { bg: "#FEF3E2", color: "#854F0B" },
  เสร็จแล้ว:  { bg: "#E8F5E9", color: "#27500A" },
  ติดปัญหา:   { bg: "#FCEBEB", color: "#791F1F" },
};
const PRIORITY_DOT: Record<string, string> = { ด่วนมาก: "#C0200A", ปานกลาง: "#CB8A1A", ไม่เร่งด่วน: "#1D9E75" };

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
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
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

  const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 14, border: "0.5px solid #F0E0DE", boxShadow: "0 1px 4px rgba(192,32,10,0.06)" };
  const sectionTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#1a1a18", display: "flex", alignItems: "center", gap: 6 };

  return (
    <>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 40px" }}>

        {/* Hero Banner */}
        <div style={{
          background: "linear-gradient(135deg, #C0200A 0%, #E03520 60%, #FF6B4A 100%)",
          borderRadius: 18, padding: "22px 20px", marginBottom: 14,
          boxShadow: "0 4px 20px rgba(192,32,10,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🍗</span>
            <div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>{getGreeting()}</p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{today}</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
            {[
              { label: "งานคงค้าง", value: tasks.length },
              { label: "เกิน Deadline", value: overdueCount, warn: true },
              { label: "โพสต์เดือนนี้", value: campaigns.filter(c => c.status === "โพสต์แล้ว").length },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.18)", borderRadius: 12, padding: "12px 8px", textAlign: "center", backdropFilter: "blur(4px)" }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: s.warn && s.value > 0 ? "#FFD166" : "#fff" }}>{s.value}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.3 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Nav */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { href: "/tasks",     icon: "📋", label: "งาน",        sub: `${tasks.length} รายการ`,         bg: "#FEE9E7", color: "#C0200A", border: "#F5C0B8" },
            { href: "https://fryday-accounting-dashboard.vercel.app", icon: "💰", label: "การเงิน", sub: summary ? `฿${formatBaht(summary.netProfit)}` : "—", bg: "#E8F5E9", color: "#27500A", border: "#C0DD97", ext: true },
            { href: "/marketing", icon: "📣", label: "Marketing",   sub: `${campaigns.length} แคมเปญ`,      bg: "#EDE9FE", color: "#3C3489", border: "#CECBF6" },
            { href: "/calendar",  icon: "🗓", label: "ปฏิทิน",     sub: "ดูตารางงาน",                       bg: "#FEF3E2", color: "#854F0B", border: "#FAC775" },
            { href: "/files",     icon: "📁", label: "ไฟล์งาน",    sub: "อัปโหลดเอกสาร",                    bg: "#F5F5F5", color: "#5F5E5A", border: "#D3D1C7" },
          ].map((q) => (
            <a key={q.href} href={q.href}
              target={q.ext ? "_blank" : undefined}
              rel={q.ext ? "noopener noreferrer" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 14px", borderRadius: 14, textDecoration: "none",
                background: q.bg, border: `0.5px solid ${q.border}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <span style={{ fontSize: 26 }}>{q.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: q.color }}>{q.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: q.color, opacity: 0.7 }}>{q.sub}</p>
              </div>
              {q.ext && <span style={{ marginLeft: "auto", fontSize: 12, color: q.color, opacity: 0.6 }}>↗</span>}
            </a>
          ))}
        </div>

        {/* Finance */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={sectionTitle}>💰 การเงินเดือนนี้</p>
            <a href="https://fryday-accounting-dashboard.vercel.app" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#C0200A", textDecoration: "none", fontWeight: 500 }}>ดูทั้งหมด ↗</a>
          </div>
          {loading || !summary
            ? <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>กำลังโหลด...</p>
            : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "รายรับ",     value: summary.totalRevenue,   bg: "#E8F5E9", color: "#27500A" },
                  { label: "รายจ่าย",   value: summary.totalExpense,   bg: "#FEE9E7", color: "#C0200A" },
                  { label: "กำไรสุทธิ", value: summary.netProfit,      bg: summary.netProfit >= 0 ? "#E8F5E9" : "#FEE9E7", color: summary.netProfit >= 0 ? "#27500A" : "#C0200A" },
                  { label: "ส่วนแบ่ง/คน", value: summary.sharePerPerson, bg: "#EDE9FE", color: "#3C3489" },
                ].map((s) => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ margin: "0 0 2px", fontSize: 11, color: s.color, opacity: 0.75 }}>{s.label}</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: s.color }}>฿{formatBaht(s.value)}</p>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Tasks */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={sectionTitle}>📋 งานล่าสุด</p>
            <a href="/tasks" style={{ fontSize: 12, color: "#C0200A", textDecoration: "none", fontWeight: 500 }}>ดูทั้งหมด ({tasks.length}) →</a>
          </div>
          {loading
            ? <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>กำลังโหลด...</p>
            : recentTasks.length === 0
              ? <p style={{ fontSize: 13, color: "#aaa", margin: 0, textAlign: "center", padding: "12px 0" }}>ไม่มีงานค้างอยู่ 🎉</p>
              : recentTasks.map((t, i) => {
                  const overdue = isOverdue(t.deadline);
                  const st = STATUS_BG[t.status] ?? { bg: "#f1efe8", color: "#73726c" };
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid #FBF0EE" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_DOT[t.priority] ?? "#ccc", marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 4, background: st.bg, color: st.color }}>{t.status}</span>
                          {t.deadline && <span style={{ fontSize: 11, color: overdue ? "#C0200A" : "#73726c" }}>{overdue ? "⚠️ " : "📅 "}{formatDate(t.deadline)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
          }
        </div>

        {/* Marketing */}
        {upcomingMkt.length > 0 && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={sectionTitle}>📣 แผนโพสต์ที่รอดำเนินการ</p>
              <a href="/marketing" style={{ fontSize: 12, color: "#C0200A", textDecoration: "none", fontWeight: 500 }}>ดูทั้งหมด →</a>
            </div>
            {upcomingMkt.map((c, i) => (
              <div key={c.id} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid #FBF0EE" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📣 {c.title}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 4, background: "#EDE9FE", color: "#3C3489" }}>{c.status}</span>
                  {c.postDate && <span style={{ fontSize: 11, color: "#73726c" }}>📅 {formatDate(c.postDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        body { background: #FBF8F5 !important; -webkit-font-smoothing: antialiased; }
        @media (max-width: 640px) {
          main { padding: 12px 12px 80px !important; }
        }
      `}</style>
    </>
  );
}