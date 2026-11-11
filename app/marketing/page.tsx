"use client";

import { useEffect, useState, useCallback } from "react";
import "../bento.css";

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

const STATUS_LIST = ["ไอเดีย", "ยังไม่ถ่าย", "ถ่ายแล้ว", "ตัดต่อแล้ว", "ตั้งเวลาแล้ว", "กำลังสร้าง", "รออนุมัติ", "โพสต์แล้ว", "วัดผล"];
const CONTENT_TYPES = ["รูปภาพ", "Reel/Video", "โปรโมชัน", "Story", "Giveaway"];
const CHANNELS = ["Facebook", "Instagram", "TikTok", "YouTube Shorts", "Instagram Reels", "Facebook Reels", "Line OA", "Shopee Food", "GrabFood"];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ไอเดีย:      { bg: "#F1EBE7", color: "#6B5A54" },
  ยังไม่ถ่าย:   { bg: "#F1EBE7", color: "#6B5A54" },
  ถ่ายแล้ว:    { bg: "#FFF0D6", color: "#8A5300" },
  ตัดต่อแล้ว:   { bg: "#FDE1EA", color: "#8A1F45" },
  กำลังสร้าง:  { bg: "#FFF0D6", color: "#8A5300" },
  รออนุมัติ:   { bg: "#FDE8E4", color: "#B3200A" },
  ตั้งเวลาแล้ว: { bg: "#FBD3C7", color: "#8F1B0B" },
  โพสต์แล้ว:  { bg: "#E3F1E6", color: "#1F5A2E" },
  วัดผล:       { bg: "#2A0B07", color: "#fff" },
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

function AddCampaignForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [selChannels, setSelChannels] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    title: "", contentType: "Reel/Video", status: "ไอเดีย", postDate: "", budget: "", link: "", notes: "",
  });

  const toggleChannel = (ch: string) =>
    setSelChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr("กรุณาใส่ชื่อแคมเปญหรือโพสต์"); return; }
    setLoading(true); setErr("");
    const res = await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, title: form.title.trim(), channels: selChannels, budget: form.budget ? parseFloat(form.budget) : 0 }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setLoading(false);
    // ไม่ปิดฟอร์มถ้าบันทึกไม่สำเร็จ เพื่อให้เห็นสาเหตุและไม่ต้องกรอกใหม่
    if (!res?.ok) { setErr([data.error ?? "เชื่อมต่อไม่ได้", data.detail].filter(Boolean).join(" · ")); return; }
    setOpen(false);
    setForm({ title: "", contentType: "Reel/Video", status: "ไอเดีย", postDate: "", budget: "", link: "", notes: "" });
    setSelChannels([]);
    onAdded();
  };

  if (!open) return (
    <div><button className="bn-btn" onClick={() => setOpen(true)}>+ เพิ่มแคมเปญ</button></div>
  );

  return (
    <div className="bn-card">
      <div className="bn-head"><h2>เพิ่มแคมเปญใหม่</h2></div>
      <div className="bn-form">
        <div className="full">
          <label>ชื่อแคมเปญ/โพสต์ *</label>
          <input className="bn-in" placeholder="เช่น โปรซื้อ 2 แถม 1 วันศุกร์" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label>ประเภท Content</label>
          <select className="bn-in" value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}>
            {CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>สถานะ</label>
          <select className="bn-in" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>วันที่โพสต์</label>
          <input className="bn-in" type="date" value={form.postDate} onChange={(e) => setForm((f) => ({ ...f, postDate: e.target.value }))} />
        </div>
        <div>
          <label>งบประมาณ (บาท)</label>
          <input className="bn-in" type="number" placeholder="0" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} />
        </div>
        <div className="full">
          <label>ช่องทาง</label>
          <div className="bn-pills">
            {CHANNELS.map((ch) => (
              <button type="button" key={ch} className="bn-pill" aria-pressed={selChannels.includes(ch)} onClick={() => toggleChannel(ch)}>{ch}</button>
            ))}
          </div>
        </div>
        <div className="full">
          <label>รายละเอียด / สคริปต์ (เก็บไว้ในหน้าแคมเปญ)</label>
          <textarea className="bn-in" style={{ minHeight: 64 }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="full">
          <label>Link โพสต์</label>
          <input className="bn-in" placeholder="https://..." value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        </div>
      </div>
      {err && <p role="alert" className="bn-err" style={{ marginTop: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="bn-btn" onClick={handleSubmit} disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</button>
        <button className="bn-btn line" onClick={() => setOpen(false)}>ยกเลิก</button>
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

  const postedPct = summary && summary.total ? Math.round((summary.posted / summary.total) * 100) : 0;

  return (
    <main className="bn">
      <section className="bn-hero">
        <div>
          <h1>Marketing Fryday</h1>
          <p>วางแผน ผลิต และติดตามผลคอนเทนต์ทุกช่องทาง</p>
        </div>
        <div className="bn-hero-side">
          {summary && <div className="bn-kpi"><b>{summary.total}</b><span>แคมเปญทั้งหมด</span></div>}
          {summary && <div className="bn-kpi"><b>{summary.posted}</b><span>โพสต์แล้ว</span></div>}
          <button className="bn-ghost" onClick={fetchData}>รีเฟรช</button>
        </div>
      </section>

      <nav className="bn-grid" aria-label="เครื่องมือ Marketing">
        <a href="/marketing/planner" className="bn-card half" style={{ gridColumn: "span 3", borderColor: "#C0200A" }}>
          <h2 style={{ fontSize: 15 }}>วางแผนคอนเทนต์</h2>
          <p className="bn-sub">ปฏิทิน วิเคราะห์ยอดขายและเทรนด์ คิดไอเดีย เขียนสคริปต์</p>
        </a>
        <a href="/marketing/studio" className="bn-card dark half" style={{ gridColumn: "span 3" }}>
          <h2 style={{ fontSize: 15 }}>Studio ทำคลิป “พิกัดร้าน”</h2>
          <p className="bn-sub">ใส่ฟุตเทจ ดูตัวอย่าง แล้วบันทึกเป็นไฟล์ 9:16</p>
        </a>
        <a href="/marketing/insights" className="bn-card tint half" style={{ gridColumn: "span 3" }}>
          <h2 style={{ fontSize: 15 }}>สถิติเพจ</h2>
          <p className="bn-sub" style={{ color: "#6B3A2E" }}>อัปโหลดข้อมูลแต่ละช่องทาง ดูยอดตามช่วงเวลา</p>
        </a>
        <a href="/tasks" className="bn-card half" style={{ gridColumn: "span 3" }}>
          <h2 style={{ fontSize: 15 }}>งานของทีม</h2>
          <p className="bn-sub">เพิ่มและติดตามงาน</p>
        </a>
      </nav>

      {loading && <p className="bn-empty">กำลังโหลด...</p>}
      {error && <p className="bn-err" role="alert">{error}</p>}

      {!loading && !error && summary && (
        <>
          <div className="bn-grid">
            <article className="bn-card wide-m" style={{ gridColumn: "span 3" }}>
              <h3>โพสต์แล้ว</h3>
              <b className="bn-big">{summary.posted}<small> / {summary.total}</small></b>
              <div className="bn-bar" role="img" aria-label={`โพสต์แล้ว ${postedPct}%`}><span style={{ width: `${postedPct}%` }} /></div>
            </article>
            <article className="bn-card half" style={{ gridColumn: "span 3" }}>
              <h3>งบรวม</h3>
              <b className="bn-big">฿{formatBaht(summary.totalBudget)}</b>
            </article>
            <article className="bn-card half" style={{ gridColumn: "span 2" }}>
              <h3>Reach รวม</h3>
              <b className="bn-big">{formatNum(summary.totalReach)}</b>
            </article>
            <article className="bn-card half" style={{ gridColumn: "span 2" }}>
              <h3>Engagement</h3>
              <b className="bn-big">{formatNum(summary.totalEngagement)}</b>
            </article>
            <article className="bn-card tint half" style={{ gridColumn: "span 2" }}>
              <h3>ยอดขายเพิ่ม</h3>
              <b className="bn-big">฿{formatBaht(summary.totalSales)}</b>
            </article>
          </div>

          <div className="bn-pills" role="group" aria-label="กรองตามสถานะ">
            {["ทั้งหมด", ...STATUS_LIST].map((s) => (
              <button key={s} className="bn-pill" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>

          <AddCampaignForm onAdded={fetchData} />

          <section className="bn-card">
            <div className="bn-head"><h2>แคมเปญ</h2><span className="bn-sub" style={{ margin: 0 }}>{campaigns.length} รายการ</span></div>
            {campaigns.length === 0 ? <p className="bn-empty">ไม่มีแคมเปญ</p> : (
              <ul className="bn-rows">
                {campaigns.map((c) => {
                  const st = STATUS_STYLE[c.status] ?? STATUS_STYLE["ไอเดีย"];
                  return (
                    <li key={c.id} className="bn-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div className="bn-row-main" style={{ minWidth: 200 }}>
                        <p style={{ whiteSpace: "normal", color: c.title.trim() ? undefined : "#a0a09a" }}>{c.title.trim() || "(ยังไม่ได้ตั้งชื่อ)"}</p>
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="bn-tag" style={{ background: st.bg, color: st.color }}>{c.status}</span>
                          {c.contentType && <span className="bn-tag" style={{ background: "#fff", border: "1px solid #EBD9D2", color: "#7A6A64" }}>{c.contentType}</span>}
                          {c.postDate && <small style={{ margin: 0 }}>{formatDate(c.postDate)}</small>}
                          {c.assignee && <small style={{ margin: 0 }}>{c.assignee}</small>}
                          {c.channels.map((ch) => <span key={ch} className="bn-tag" style={{ background: "#FDE8E4", color: "#B3200A" }}>{ch}</span>)}
                        </div>
                        {(c.budget > 0 || c.reach > 0 || c.engagement > 0 || c.salesIncrease > 0) && (
                          <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", fontSize: 12, color: "#7A6A64" }}>
                            {c.budget > 0 && <span>งบ <b style={{ color: "#2A0B07" }}>฿{formatBaht(c.budget)}</b></span>}
                            {c.reach > 0 && <span>Reach <b style={{ color: "#2A0B07" }}>{formatNum(c.reach)}</b></span>}
                            {c.engagement > 0 && <span>Engagement <b style={{ color: "#2A0B07" }}>{formatNum(c.engagement)}</b></span>}
                            {c.salesIncrease > 0 && <span>ยอดขายเพิ่ม <b style={{ color: "#2E8B6A" }}>฿{formatBaht(c.salesIncrease)}</b></span>}
                          </div>
                        )}
                      </div>
                      {c.link && (
                        <a href={c.link} target="_blank" rel="noopener noreferrer" className="bn-pill" style={{ flex: "none" }}>ดูโพสต์ ↗</a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
