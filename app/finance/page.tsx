"use client";

import { useEffect, useState, useCallback } from "react";

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

// ---- Stat Card ----
function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "16px 20px", flex: "1 1 160px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#73726c" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 500, color, lineHeight: 1.2 }}>฿{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#73726c" }}>{sub}</p>}
    </div>
  );
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

  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#faf9f5", color: "#1a1a18", boxSizing: "border-box" };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ fontSize: 13, padding: "8px 18px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "#fff", color: "#1a1a18", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
      + เพิ่มรายการ
    </button>
  );

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>เพิ่มรายการใหม่</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>ชื่อรายการ *</p>
          <input style={inp} placeholder="เช่น ยอดขาย 16 พ.ค." value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>ประเภท</p>
          <select style={inp} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "รายรับ" | "รายจ่าย" }))}>
            <option>รายรับ</option>
            <option>รายจ่าย</option>
          </select>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>จำนวนเงิน (บาท) *</p>
          <input style={inp} type="number" placeholder="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>หมวดหมู่</p>
          <select style={inp} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>วันที่</p>
          <input style={inp} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#73726c" }}>ช่องทางชำระ</p>
          <select style={inp} value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 99, border: "none", background: "#1D9E75", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button onClick={() => setOpen(false)} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "transparent", color: "#73726c", cursor: "pointer" }}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

// ---- Bar Chart (CSS only) ----
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#73726c", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 500, color: "#1a1a18" }}>฿{formatBaht(value)}</span>
      </div>
      <div style={{ height: 6, background: "#f1efe8", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
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

  // category breakdown
  const categoryTotals = CATEGORIES.map((cat) => ({
    cat,
    total: transactions.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0),
  })).filter((c) => c.total > 0);
  const maxCat = Math.max(...categoryTotals.map((c) => c.total), 1);

  const filtered = typeFilter === "ทั้งหมด" ? transactions : transactions.filter((t) => t.type === typeFilter);

  return (
    <main style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "#1a1a18" }}>💰 Fryday — Finance</h1>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ fontSize: 13, padding: "6px 12px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "#fff", color: "#1a1a18", cursor: "pointer", marginLeft: "auto" }} />
        <button onClick={fetchData} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "transparent", color: "#73726c", cursor: "pointer" }}>
          🔄 รีเฟรช
        </button>
      </div>

      {loading && <p style={{ color: "#73726c", fontSize: 14 }}>กำลังโหลด...</p>}
      {error   && <p style={{ color: "#A32D2D", fontSize: 14 }}>❌ {error}</p>}

      {!loading && !error && summary && (
        <>
          {/* Summary Cards */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="รายรับรวม"    value={formatBaht(summary.totalRevenue)}   color="#1D9E75" />
            <StatCard label="รายจ่ายรวม"   value={formatBaht(summary.totalExpense)}   color="#D85A30" />
            <StatCard label="กำไรสุทธิ"    value={formatBaht(summary.netProfit)}
              color={summary.netProfit >= 0 ? "#185FA5" : "#A32D2D"}
              sub={summary.netProfit >= 0 ? "กำไร" : "ขาดทุน"} />
          </div>

          {/* Partner Share Cards */}
          <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>ส่วนแบ่งหุ้นส่วน — แบ่งเท่ากัน 3 คน</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {PARTNERS.map((name, i) => (
                <div key={i} style={{ flex: "1 1 140px", background: "#f6f5f0", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: ["#E6F1FB","#EAF3DE","#FAEEDA"][i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: ["#185FA5","#27500A","#854F0B"][i], marginBottom: 8 }}>
                    {name.charAt(name.length - 1)}
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: 12, color: "#73726c" }}>{name}</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: summary.sharePerPerson >= 0 ? "#1D9E75" : "#A32D2D" }}>
                    ฿{formatBaht(summary.sharePerPerson)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryTotals.length > 0 && (
            <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>แยกตามหมวดหมู่</p>
              {categoryTotals.map(({ cat, total }) => (
                <MiniBar key={cat} label={cat} value={total} max={maxCat}
                  color={["ยอดขาย"].includes(cat) ? "#1D9E75" : "#D85A30"} />
              ))}
            </div>
          )}

          {/* Add Transaction */}
          <AddTransactionForm onAdded={fetchData} />

          {/* Transaction List */}
          <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "0.5px solid #e5e3db", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>รายการทั้งหมด</p>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {(["ทั้งหมด","รายรับ","รายจ่าย"] as const).map((t) => (
                  <button key={t} onClick={() => setTypeFilter(t)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, border: `0.5px solid ${typeFilter === t ? "#1D9E75" : "#d3d1c7"}`, background: typeFilter === t ? "#EAF3DE" : "transparent", color: typeFilter === t ? "#27500A" : "#73726c", cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "#aaa" }}>ไม่มีรายการ</p>
            ) : (
              filtered.map((t, i) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: i === 0 ? "none" : "0.5px solid #f1efe8", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: t.type === "รายรับ" ? "#EAF3DE" : "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {t.type === "รายรับ" ? "💚" : "🔴"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#73726c" }}>{t.category} · {formatDate(t.date)}{t.recordedBy ? ` · ${t.recordedBy}` : ""}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.type === "รายรับ" ? "#1D9E75" : "#D85A30" }}>
                      {t.type === "รายรับ" ? "+" : "-"}฿{formatBaht(t.amount)}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#73726c" }}>ส่วนแบ่ง ฿{formatBaht(Math.abs(t.sharePerPerson))}/คน</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}