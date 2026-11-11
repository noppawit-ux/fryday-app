"use client";

import { useEffect, useState, useCallback } from "react";
import "../bento.css";

interface Transaction {
  id: string;
  title: string;
  date: string | null;
  type: "รายรับ" | "รายจ่าย";
  category: string;
  amount: number;
  netAmount: number;
  sharePerPerson: number;
  channel: string | null;
  recordedBy: string | null;
}

interface Summary {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  sharePerPerson: number;
}

// ---- หุ้นส่วน 4 คน (แก้ชื่อได้) ----
const PARTNERS = ["BOOM", "BOOK", "TAO", "NAN"];

const CATEGORIES = ["ยอดขาย","วัตถุดิบ","ค่าแรง","ค่าเช่า","ค่าน้ำ/ไฟ","อุปกรณ์","การตลาด","อื่นๆ"];
const CHANNELS   = ["เงินสด","โอนธนาคาร","QR Code","บัตรเครดิต"];

function formatBaht(n: number): string {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

// ---- Add Transaction Form ----
function AddTransactionForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState({
    title: "", date: "", type: "รายรับ", category: "ยอดขาย", amount: "", channel: "เงินสด",
  });

  const handleSubmit = async () => {
    if (!form.title || !form.amount) return;
    setLoading(true);
    await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setLoading(false);
    setOpen(false);
    setForm({ title: "", date: "", type: "รายรับ", category: "ยอดขาย", amount: "", channel: "เงินสด" });
    onAdded();
  };

  if (!open) return (
    <div><button className="bn-btn" onClick={() => setOpen(true)}>+ เพิ่มรายการ</button></div>
  );

  return (
    <div className="bn-card">
      <div className="bn-head"><h2>เพิ่มรายการใหม่</h2></div>
      <div className="bn-form">
        <div className="full">
          <label>ชื่อรายการ *</label>
          <input className="bn-in" placeholder="เช่น ยอดขาย 16 พ.ค." value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label>ประเภท</label>
          <select className="bn-in" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "รายรับ" | "รายจ่าย" }))}>
            <option>รายรับ</option>
            <option>รายจ่าย</option>
          </select>
        </div>
        <div>
          <label>จำนวนเงิน (บาท) *</label>
          <input className="bn-in" type="number" placeholder="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
        <div>
          <label>หมวดหมู่</label>
          <select className="bn-in" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>วันที่</label>
          <input className="bn-in" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label>ช่องทางชำระ</label>
          <select className="bn-in" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="bn-btn" onClick={handleSubmit} disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</button>
        <button className="bn-btn line" onClick={() => setOpen(false)}>ยกเลิก</button>
      </div>
    </div>
  );
}

// ---- Bar (CSS only) ----
function MiniBar({ label, value, max, income }: { label: string; value: number; max: number; income: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#7A6A64", marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: "#2A0B07" }}>฿{formatBaht(value)}</span>
      </div>
      <div style={{ height: 10, background: "#F3E3DD", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: income ? "linear-gradient(90deg,#4DB38C,#2E8B6A)" : "linear-gradient(90deg,#E8452B,#C0200A)", borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary]           = useState<Summary | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [month, setMonth]               = useState(() => new Date().toISOString().slice(0, 7));
  const [typeFilter, setTypeFilter]     = useState<"ทั้งหมด" | "รายรับ" | "รายจ่าย">("ทั้งหมด");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ month });
      const res = await fetch(`/api/finance?${params}`);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setTransactions(data.transactions);
      setSummary(data.summary);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categoryTotals = CATEGORIES.map((cat) => ({
    cat,
    total: transactions.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0),
  })).filter((c) => c.total > 0);
  const maxCat = Math.max(...categoryTotals.map((c) => c.total), 1);

  const filtered = typeFilter === "ทั้งหมด" ? transactions : transactions.filter((t) => t.type === typeFilter);
  const rev = summary?.totalRevenue ?? 0;
  const exp = summary?.totalExpense ?? 0;
  const expPct = rev > 0 ? Math.min(100, Math.round((exp / rev) * 100)) : exp > 0 ? 100 : 0;
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <main className="bn">
      <section className="bn-hero">
        <div>
          <h1>การเงิน Fryday</h1>
          <p>สรุปรายรับรายจ่ายประจำ{monthLabel}</p>
        </div>
        <div className="bn-hero-side">
          {summary && (
            <div className={"bn-kpi " + (summary.netProfit >= 0 ? "pos" : "neg")}>
              <b>฿{formatBaht(summary.netProfit)}</b><span>{summary.netProfit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</span>
            </div>
          )}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="เลือกเดือน" />
          <button className="bn-ghost" onClick={fetchData}>รีเฟรช</button>
        </div>
      </section>

      {loading && <p className="bn-empty">กำลังโหลด...</p>}
      {error && <p className="bn-err" role="alert">{error}</p>}

      {!loading && !error && summary && (
        <>
          <div className="bn-grid">
            <article className="bn-card half" style={{ gridColumn: "span 4" }}>
              <h3>รายรับรวม</h3>
              <b className="bn-big" style={{ color: "#2E8B6A" }}>฿{formatBaht(summary.totalRevenue)}</b>
              <p className="bn-sub">{transactions.filter((t) => t.type === "รายรับ").length} รายการ</p>
            </article>
            <article className="bn-card half" style={{ gridColumn: "span 4" }}>
              <h3>รายจ่ายรวม</h3>
              <b className="bn-big" style={{ color: "#C0200A" }}>฿{formatBaht(summary.totalExpense)}</b>
              <div className="bn-bar" role="img" aria-label={`รายจ่าย ${expPct}% ของรายรับ`}><span style={{ width: `${expPct}%` }} /></div>
              <p className="bn-sub">{expPct}% ของรายรับ</p>
            </article>
            <article className="bn-card tint wide-m" style={{ gridColumn: "span 4" }}>
              <h3>ส่วนแบ่งต่อคน</h3>
              <b className="bn-big">฿{formatBaht(summary.sharePerPerson)}</b>
              <p className="bn-sub">{summary.netProfit >= 0 ? "จากกำไรสุทธิเดือนนี้" : "ขาดทุนเฉลี่ยต่อคน"}</p>
            </article>

            <section className="bn-card" style={{ gridColumn: "span 7" }}>
              <div className="bn-head"><h2>หุ้นส่วน</h2><span className="bn-sub" style={{ margin: 0 }}>แบ่งเท่ากัน</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                {PARTNERS.map((name, i) => (
                  <div key={name} style={{ background: "#FBF4F0", borderRadius: 16, padding: "12px 14px" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ["#2A0B07", "#C0200A", "#FF8A66", "#F3C6B8"][i % 4], color: i === 3 ? "#5A1A10" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{name.charAt(0)}</div>
                    <p style={{ fontSize: 12, color: "#7A6A64" }}>{name}</p>
                    <p style={{ fontSize: 17, fontWeight: 600, color: summary.sharePerPerson >= 0 ? "#2A0B07" : "#A32D2D" }}>฿{formatBaht(summary.sharePerPerson)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bn-card" style={{ gridColumn: "span 5" }}>
              <div className="bn-head"><h2>แยกตามหมวดหมู่</h2></div>
              {categoryTotals.length === 0 ? <p className="bn-empty">ยังไม่มีรายการ</p> : categoryTotals.map(({ cat, total }) => (
                <MiniBar key={cat} label={cat} value={total} max={maxCat} income={cat === "ยอดขาย"} />
              ))}
            </section>
          </div>

          <AddTransactionForm onAdded={fetchData} />

          <section className="bn-card">
            <div className="bn-head">
              <h2>รายการทั้งหมด</h2>
              <div className="bn-pills">
                {(["ทั้งหมด", "รายรับ", "รายจ่าย"] as const).map((t) => (
                  <button key={t} className="bn-pill" aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>{t}</button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? <p className="bn-empty">ไม่มีรายการ</p> : (
              <ul className="bn-rows">
                {filtered.map((t) => (
                  <li key={t.id} className={"bn-row" + (t.type === "รายรับ" ? " in" : "")}>
                    <div className="bn-row-main">
                      <p>{t.title}</p>
                      <small>{t.category} · {formatDate(t.date)}{t.recordedBy ? ` · ${t.recordedBy}` : ""}</small>
                    </div>
                    <div className="bn-amt" style={{ color: t.type === "รายรับ" ? "#2E8B6A" : "#C0200A" }}>
                      {t.type === "รายรับ" ? "+" : "-"}฿{formatBaht(t.amount)}
                      <small>ส่วนแบ่ง ฿{formatBaht(Math.abs(t.sharePerPerson))}/คน</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
