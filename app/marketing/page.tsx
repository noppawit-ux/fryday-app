"use client";

import { useEffect, useState, useCallback } from "react";

interface Campaign {
  id: string;
  title: string;
  contentType: string | null;
  channels: string[];
  status: string;
  postDate: string | null;
  budget: number;
  reach: number;
  engagement: number;
  salesIncrease: number;
  assignee: string | null;
  link: string | null;
}

interface Summary {
  totalBudget: number;
  totalReach: number;
  totalEngagement: number;
  totalSales: number;
  posted: number;
  total: number;
}

const STATUS_LIST = ["ไอเดีย", "กำลังสร้าง", "รออนุมัติ", "โพสต์แล้ว", "วัดผล"];
const CONTENT_TYPES = ["รูปภาพ", "Reel/Video", "โปรโมชัน", "Story", "Giveaway"];
const CHANNELS = ["Facebook", "Instagram", "TikTok", "Line OA", "Shopee Food", "GrabFood"];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  ไอเดีย:      { bg: "#F1EFE8", color: "#5F5E5A", border: "#D3D1C7" },
  กำลังสร้าง:  { bg: "#FAEEDA", color: "#854F0B", border: "#FAC775" },
  รออนุมัติ:   { bg: "#E6F1FB", color: "#185FA5", border: "#B5D4F4" },
  โพสต์แล้ว:  { bg: "#EAF3DE", color: "#27500A", border: "#C0DD97" },
  วัดผล:       { bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6" },
};

const CONTENT_ICON: Record<string, string> = {
  รูปภาพ: "📸", "Reel/Video": "🎬", โปรโมชัน: "📣", Story: "📝", Giveaway: "🎁",
};

const CHANNEL_ICON: Record<string, string> = {
  Facebook: "f", Instagram: "ig", TikTok: "tt", "Line OA": "L", "Shopee Food": "sf", GrabFood: "G",
};

function formatBaht(n: number) {
  return new Intl.NumberFormat("th-TH").format(Math.round(n));
}

function formatNum(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "14px 18px", flex: "1 1 130px" }}>
      <p style={{ margin: "0 0 5px", fontSize: 12, color: "#73726c" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: color ?? "#1a1a18" }}>{value}</p>
      {sub && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#73726c" }}>{sub}</p>}
    </div>
  );
}

function AddCampaignForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [selChannels, setSelChannels] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "", contentType: "รูปภาพ", status: "ไอเดีย", postDate: "", budget: "", link: "",
  });

  const toggleChannel = (ch: string) =>
    setSelChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);

  const handleSubmit = async () => {
    if (!form.title) return;
    setLoading(true);
    await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, channels: selChannels, budget: form.budget ? parseFloat(form.budget) : 0 }),
    });
    setLoading(false);
    setOpen(false);
    setForm({ title: "", contentType: "รูปภาพ", status: "ไอเดีย", postDate: "", budget: "", link: "" });
    setSelChannels([]);
    onAdded();
  };

  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#faf9f5", color: "#1a1a18", boxSizing: "border-box" };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ fontSize: 13, padding: "8px 18px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "#fff", color: "#1a1a18", cursor: "pointer", marginBottom: 16 }}>
      + เพิ่มแคมเปญ
    </button>
  );

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>เพิ่มแคมเปญใหม่</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>ชื่อแคมเปญ/โพสต์ *</p>
          <input style={inp} placeholder="เช่น โปรซื้อ 2 แถม 1 วันศุกร์" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>ประเภท Content</p>
          <select style={inp} value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}>
            {CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>สถานะ</p>
          <select style={inp} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>วันที่โพสต์</p>
          <input style={inp} type="date" value={form.postDate} onChange={(e) => setForm((f) => ({ ...f, postDate: e.target.value }))} />
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>งบประมาณ (บาท)</p>
          <input style={inp} type="number" placeholder="0" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#73726c" }}>ช่องทาง</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CHANNELS.map((ch) => {
              const active = selChannels.includes(ch);
              return (
                <button key={ch} onClick={() => toggleChannel(ch)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, border: `0.5px solid ${active ? "#534AB7" : "#d3d1c7"}`, background: active ? "#EEEDFE" : "transparent", color: active ? "#3C3489" : "#73726c", cursor: "pointer" }}>
                  {ch}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>Link โพสต์</p>
          <input style={inp} placeholder="https://..." value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 99, border: "none", background: "#534AB7", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button onClick={() => setOpen(false)} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "transparent", color: "#73726c", cursor: "pointer" }}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ทั้งหมด");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ทั้งหมด") params.set("status", statusFilter);
      const res = await fetch(`/api/marketing?${params}`);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setCampaigns(data.campaigns);
      setSummary(data.summary);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <main style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "#1a1a18" }}>📣 Fryday — Marketing</h1>
        <button onClick={fetchData} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "transparent", color: "#73726c", cursor: "pointer", marginLeft: "auto" }}>
          🔄 รีเฟรช
        </button>
      </div>

      {loading && <p style={{ color: "#73726c", fontSize: 14 }}>กำลังโหลด...</p>}
      {error   && <p style={{ color: "#A32D2D", fontSize: 14 }}>❌ {error}</p>}

      {!loading && !error && summary && (
        <>
          {/* Summary */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="แคมเปญทั้งหมด" value={String(summary.total)} sub={`โพสต์แล้ว ${summary.posted} รายการ`} />
            <StatCard label="งบรวม" value={`฿${formatBaht(summary.totalBudget)}`} color="#D85A30" />
            <StatCard label="Reach รวม" value={formatNum(summary.totalReach)} color="#185FA5" />
            <StatCard label="Engagement รวม" value={formatNum(summary.totalEngagement)} color="#534AB7" />
            <StatCard label="ยอดขายเพิ่ม" value={`฿${formatBaht(summary.totalSales)}`} color="#1D9E75" />
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {["ทั้งหมด", ...STATUS_LIST].map((s) => {
              const st = STATUS_STYLE[s] ?? { bg: "#F1EFE8", color: "#5F5E5A", border: "#D3D1C7" };
              const active = statusFilter === s;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{ fontSize: 12, padding: "5px 14px", borderRadius: 99, border: `0.5px solid ${active ? st.border : "#d3d1c7"}`, background: active ? st.bg : "transparent", color: active ? st.color : "#73726c", cursor: "pointer", fontWeight: active ? 500 : 400 }}>
                  {s}
                </button>
              );
            })}
          </div>

          {/* Add Form */}
          <AddCampaignForm onAdded={fetchData} />

          {/* Campaign Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {campaigns.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "#aaa" }}>ไม่มีแคมเปญ</p>
            ) : (
              campaigns.map((c) => {
                const st = STATUS_STYLE[c.status] ?? STATUS_STYLE["ไอเดีย"];
                return (
                  <div key={c.id} style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{CONTENT_ICON[c.contentType ?? ""] ?? "📋"}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>{c.title}</p>
                        <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, fontWeight: 500 }}>
                            {c.status}
                          </span>
                          {c.postDate && <span style={{ fontSize: 11, color: "#73726c" }}>📅 {formatDate(c.postDate)}</span>}
                          {c.assignee && <span style={{ fontSize: 11, color: "#73726c" }}>👤 {c.assignee}</span>}
                        </div>
                      </div>
                      {c.link && (
                        <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#185FA5", textDecoration: "none", padding: "4px 10px", border: "0.5px solid #B5D4F4", borderRadius: 99, background: "#E6F1FB", flexShrink: 0 }}>
                          ดูโพสต์ ↗
                        </a>
                      )}
                    </div>

                    {/* Channels */}
                    {c.channels.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                        {c.channels.map((ch) => (
                          <span key={ch} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#EEEDFE", color: "#3C3489", border: "0.5px solid #CECBF6" }}>
                            {CHANNEL_ICON[ch] ? "" : ""}{ch}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Stats row */}
                    {(c.budget > 0 || c.reach > 0 || c.engagement > 0 || c.salesIncrease > 0) && (
                      <div style={{ display: "flex", gap: 16, paddingTop: 8, borderTop: "0.5px solid #f1efe8", flexWrap: "wrap" }}>
                        {c.budget > 0 && <div style={{ fontSize: 12 }}><span style={{ color: "#73726c" }}>งบ </span><span style={{ fontWeight: 500, color: "#D85A30" }}>฿{formatBaht(c.budget)}</span></div>}
                        {c.reach > 0 && <div style={{ fontSize: 12 }}><span style={{ color: "#73726c" }}>Reach </span><span style={{ fontWeight: 500, color: "#185FA5" }}>{formatNum(c.reach)}</span></div>}
                        {c.engagement > 0 && <div style={{ fontSize: 12 }}><span style={{ color: "#73726c" }}>Engagement </span><span style={{ fontWeight: 500, color: "#534AB7" }}>{formatNum(c.engagement)}</span></div>}
                        {c.salesIncrease > 0 && <div style={{ fontSize: 12 }}><span style={{ color: "#73726c" }}>ยอดขายเพิ่ม </span><span style={{ fontWeight: 500, color: "#1D9E75" }}>฿{formatBaht(c.salesIncrease)}</span></div>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </main>
  );
}