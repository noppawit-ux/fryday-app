"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

/* ---------- วางแผนคอนเทนต์: ปฏิทิน · ไอเดีย · สคริปต์ ----------
   ใช้ข้อมูลชุดเดียวกับหน้า Marketing (ตารางแคมเปญใน Notion) */

interface Campaign { id: string; title: string; contentType: string | null; channels: string[]; status: string; postDate: string | null; link: string | null }
interface Idea { title: string; format: string; channels: string[]; hook: string; why: string; effort: string }
interface Shot { t: string; visual: string; onscreen: string; voice: string }
interface Script { hook: string; shots: Shot[]; caption: string; hashtags: string[]; cta: string; props: string[]; tips: string[] }
interface Draft { title: string; format: string; channel: string; notes: string; campaignId: string | null }

const RED = "#C0200A", MUTED = "#73726c", LINE = "#e5e3db";
const STATUS = ["ไอเดีย", "กำลังสร้าง", "รออนุมัติ", "โพสต์แล้ว", "วัดผล"];
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  ไอเดีย: { bg: "#F1EFE8", fg: "#5F5E5A" }, กำลังสร้าง: { bg: "#FAEEDA", fg: "#854F0B" }, รออนุมัติ: { bg: "#E6F1FB", fg: "#185FA5" },
  โพสต์แล้ว: { bg: "#EAF3DE", fg: "#27500A" }, วัดผล: { bg: "#EEEDFE", fg: "#3C3489" },
};
const FORMATS = ["พิกัดร้าน", "เมนู/ASMR", "เบื้องหลังครัว", "บอร์ดเกมในร้าน", "โปรโมชัน", "ถาม-ตอบ/โพล", "ตามเทรนด์", "รีวิวลูกค้า"];
const CHANNELS = ["Facebook", "Instagram", "TikTok", "YouTube Shorts"];
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const BRAND_KEY = "fryday-planner-brand-v1";
const DEFAULT_BRAND = `Fryday ร้านไก่ทอด
จุดขาย: นั่งแอร์ได้ มีบอร์ดเกมให้เล่นในร้าน
ที่ตั้ง: ติด 3 แยกไฟแดง หลังโรงเรียนสตรีราชินูทิศ
ปิดทุกวันพฤหัสบดี (เริ่ม 12 พ.ย. 2569)
ช่องทางที่มี: Facebook Page, Instagram Reels, TikTok, YouTube Shorts`;

const card: CSSProperties = { background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 12, padding: 16 };
const input: CSSProperties = { font: "inherit", fontSize: 14, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%", background: "#fff", boxSizing: "border-box" };
const btn: CSSProperties = { font: "inherit", fontSize: 13, padding: "7px 12px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", cursor: "pointer" };
const btnP: CSSProperties = { ...btn, background: RED, color: "#fff", borderColor: RED, fontWeight: 600 };
const lab: CSSProperties = { display: "block", fontSize: 12, color: MUTED, margin: "0 0 4px" };

const todayStr = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const addDays = (s: string, n: number) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const dowOf = (s: string) => new Date(s + "T00:00:00Z").getUTCDay();
const thDate = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const typeOf = (format: string) => (format === "โปรโมชัน" ? "โปรโมชัน" : format === "ถาม-ตอบ/โพล" ? "Story" : "Reel/Video");

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "เชื่อมต่อไม่ได้" } as T & { error?: string } };
  }
}

function scriptText(d: Draft, sc: Script) {
  return [
    `สคริปต์: ${d.title}`, `รูปแบบ: ${d.format || "-"}`, "",
    `ฮุก: ${sc.hook}`, "", "ช็อต:",
    ...sc.shots.map((s, i) => `${i + 1}. [${s.t} วิ] ภาพ: ${s.visual}${s.onscreen ? ` | ข้อความบนจอ: ${s.onscreen}` : ""}${s.voice ? ` | เสียง: ${s.voice}` : ""}`),
    "", `CTA: ${sc.cta}`, "", "แคปชัน:", sc.caption, sc.hashtags.join(" "),
    "", sc.props.length ? `เตรียมของ: ${sc.props.join(", ")}` : "", ...(sc.tips.length ? ["เคล็ดลับ:", ...sc.tips.map((t) => `- ${t}`)] : []),
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

export default function PlannerPage() {
  const [tab, setTab] = useState<"cal" | "ideas" | "script">("cal");
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [draft, setDraft] = useState<Draft>({ title: "", format: "พิกัดร้าน", channel: "", notes: "", campaignId: null });

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const { ok, data } = await api<{ campaigns: Campaign[] }>("/api/marketing");
    if (ok) setItems(data.campaigns); else setErr(data.error ?? "โหลดไม่สำเร็จ");
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(load); }, [load]);
  useEffect(() => {
    queueMicrotask(() => { try { const b = localStorage.getItem(BRAND_KEY); if (b) setBrand(b); } catch { /* ใช้ค่าเริ่มต้น */ } });
  }, []);
  const saveBrand = (v: string) => { setBrand(v); try { localStorage.setItem(BRAND_KEY, v); } catch { /* ไม่เป็นไร */ } };

  const tabBtn = (k: typeof tab, label: string) => (
    <button onClick={() => setTab(k)} style={{ ...btn, background: tab === k ? RED : "#fff", color: tab === k ? "#fff" : "#1a1a18", borderColor: tab === k ? RED : LINE, fontWeight: tab === k ? 600 : 400 }}>{label}</button>
  );

  return (
    <main style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <a href="/marketing" style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}>← Marketing</a>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>🗓 วางแผนคอนเทนต์</h1>
        <a href="/marketing/studio" style={{ ...btn, marginLeft: "auto", textDecoration: "none", color: "#1a1a18" }}>🎬 Studio ทำคลิป</a>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabBtn("cal", "ปฏิทิน")}{tabBtn("ideas", "คิดไอเดีย")}{tabBtn("script", "ออกแบบสคริปต์")}
      </div>
      {err && <p role="alert" style={{ color: RED, fontSize: 14 }}>❌ {err}</p>}
      {loading && <p style={{ color: MUTED, fontSize: 14 }}>กำลังโหลด…</p>}

      {tab === "cal" && <Calendar items={items} reload={load} toScript={(c) => { setDraft({ title: c.title, format: "พิกัดร้าน", channel: "", notes: "", campaignId: c.id }); setTab("script"); }} />}
      {tab === "ideas" && <Ideas items={items} brand={brand} saveBrand={saveBrand} reload={load} toScript={(i, id) => { setDraft({ title: i.title, format: i.format, channel: i.channels[0] ?? "", notes: `ฮุกที่คิดไว้: ${i.hook}`, campaignId: id }); setTab("script"); }} />}
      {tab === "script" && <ScriptDesigner brand={brand} draft={draft} setDraft={setDraft} reload={load} />}
    </main>
  );
}

/* ---------------- ปฏิทิน ---------------- */
function Calendar({ items, reload, toScript }: { items: Campaign[]; reload: () => void; toScript: (c: Campaign) => void }) {
  const t0 = todayStr();
  const [ym, setYm] = useState({ y: Number(t0.slice(0, 4)), m: Number(t0.slice(5, 7)) - 1 });
  const [sel, setSel] = useState<string>(t0);
  const [open, setOpen] = useState<Campaign | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState({ title: "", format: "พิกัดร้าน" });
  const [perWeek, setPerWeek] = useState<number[]>([2, 5, 0]);
  const [plan, setPlan] = useState<{ id: string; title: string; date: string }[] | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, Campaign[]>();
    for (const c of items) if (c.postDate) { const k = c.postDate.slice(0, 10); m.set(k, [...(m.get(k) ?? []), c]); }
    return m;
  }, [items]);
  const unscheduled = items.filter((c) => !c.postDate && (c.status === "ไอเดีย" || c.status === "กำลังสร้าง"));

  const first = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
  const dim = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => ymd(ym.y, ym.m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const title = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });
  const go = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  const patch = async (id: string, body: object) => { setBusy(true); await api(`/api/marketing/${id}`, { method: "PATCH", body: JSON.stringify(body) }); setBusy(false); await reload(); };
  const pick = async (c: Campaign) => {
    setOpen(c); setNotes(null);
    const { ok, data } = await api<{ notes: string }>(`/api/marketing/${c.id}`);
    setNotes(ok ? data.notes : "");
  };
  const addQuick = async () => {
    if (!quick.title.trim()) return;
    setBusy(true);
    await api("/api/marketing", { method: "POST", body: JSON.stringify({ title: quick.title.trim(), contentType: typeOf(quick.format), status: "ไอเดีย", postDate: sel, notes: `รูปแบบ: ${quick.format}` }) });
    setQuick((q) => ({ ...q, title: "" })); setBusy(false); await reload();
  };

  const suggest = () => {
    const taken = new Map<string, number>(); byDate.forEach((v, k) => taken.set(k, v.length));
    const out: { id: string; title: string; date: string }[] = [];
    let d = addDays(todayStr(), 1);
    for (let i = 0; i < 120 && out.length < unscheduled.length; i++, d = addDays(d, 1)) {
      if (perWeek.includes(dowOf(d)) && !taken.get(d)) out.push({ id: unscheduled[out.length].id, title: unscheduled[out.length].title, date: d });
    }
    setPlan(out);
  };
  const applyPlan = async () => {
    if (!plan) return; setBusy(true);
    for (const p of plan) await api(`/api/marketing/${p.id}`, { method: "PATCH", body: JSON.stringify({ postDate: p.date }) });
    setPlan(null); setBusy(false); await reload();
  };

  const dayItems = byDate.get(sel) ?? [];

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <section style={{ ...card, flex: "2 1 520px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <button style={btn} onClick={() => go(-1)} aria-label="เดือนก่อน">‹</button>
          <strong style={{ flex: 1, textAlign: "center" }}>{title}</strong>
          <button style={btn} onClick={() => go(1)} aria-label="เดือนถัดไป">›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {DOW.map((d) => <div key={d} style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>{d}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const list = byDate.get(c) ?? [];
            const isSel = c === sel, isToday = c === t0;
            return (
              <button key={c} onClick={() => setSel(c)} style={{ minHeight: 78, textAlign: "left", padding: 4, borderRadius: 8, cursor: "pointer", font: "inherit", background: isSel ? "#FFF3EE" : "#fff", border: `1px solid ${isSel ? RED : LINE}`, overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? RED : "#1a1a18" }}>{Number(c.slice(8))}</div>
                {list.slice(0, 2).map((x) => { const col = STATUS_COLOR[x.status] ?? STATUS_COLOR["ไอเดีย"]; return <div key={x.id} style={{ fontSize: 10, background: col.bg, color: col.fg, borderRadius: 4, padding: "1px 4px", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.title}</div>; })}
                {list.length > 2 && <div style={{ fontSize: 10, color: MUTED }}>+{list.length - 2}</div>}
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>{thDate(sel)}</h2>
          {dayItems.length === 0 && <p style={{ margin: "0 0 8px", fontSize: 13, color: MUTED }}>ยังไม่มีโพสต์ในวันนี้</p>}
          {dayItems.map((c) => (
            <button key={c.id} onClick={() => pick(c)} style={{ ...btn, display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>{c.title} <span style={{ color: MUTED, fontSize: 11 }}>· {c.status}</span></button>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input style={input} placeholder="เพิ่มโพสต์ในวันนี้" value={quick.title} onChange={(e) => setQuick((q) => ({ ...q, title: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addQuick()} />
            <button style={btnP} disabled={busy} onClick={addQuick}>+</button>
          </div>
          <select style={{ ...input, marginTop: 6 }} aria-label="รูปแบบ" value={quick.format} onChange={(e) => setQuick((q) => ({ ...q, format: e.target.value }))}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
        </section>

        {open && (
          <section style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <strong style={{ flex: 1, fontSize: 14 }}>{open.title}</strong>
              <button style={btn} onClick={() => setOpen(null)} aria-label="ปิด">✕</button>
            </div>
            <label style={{ ...lab, marginTop: 10 }}>สถานะ</label>
            <select style={input} value={open.status} disabled={busy} onChange={async (e) => { await patch(open.id, { status: e.target.value }); setOpen({ ...open, status: e.target.value }); }}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            <label style={{ ...lab, marginTop: 8 }}>วันที่โพสต์</label>
            <input type="date" style={input} value={open.postDate?.slice(0, 10) ?? ""} disabled={busy} onChange={async (e) => { await patch(open.id, { postDate: e.target.value || null }); setOpen({ ...open, postDate: e.target.value || null }); }} />
            <label style={{ ...lab, marginTop: 8 }}>สคริปต์/โน้ต</label>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, maxHeight: 220, overflow: "auto", background: "#faf9f5", borderRadius: 8, padding: 8, fontFamily: "inherit" }}>{notes === null ? "กำลังโหลด…" : notes || "ยังไม่มีสคริปต์"}</pre>
            <button style={{ ...btn, marginTop: 8 }} onClick={() => toScript(open)}>✍️ ออกแบบสคริปต์ให้โพสต์นี้</button>
          </section>
        )}

        <section style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>ยังไม่กำหนดวัน ({unscheduled.length})</h2>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: MUTED }}>เลือกวันที่จะโพสต์ในแต่ละสัปดาห์ แล้วให้ระบบเสนอตาราง คุณยืนยันก่อนจึงบันทึก</p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {DOW.map((d, i) => { const on = perWeek.includes(i); return <button key={d} aria-pressed={on} onClick={() => setPerWeek((p) => (on ? p.filter((x) => x !== i) : [...p, i]))} style={{ ...btn, padding: "4px 10px", background: on ? "#FFF3EE" : "#fff", borderColor: on ? RED : LINE }}>{d}</button>; })}
          </div>
          <button style={btn} disabled={!unscheduled.length || !perWeek.length} onClick={suggest}>เสนอตาราง</button>
          {plan && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              {plan.map((p) => <div key={p.id}>{thDate(p.date)} · {p.title}</div>)}
              {plan.length < unscheduled.length && <div style={{ color: MUTED }}>จัดได้ {plan.length} จาก {unscheduled.length} รายการ</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}><button style={btnP} disabled={busy || !plan.length} onClick={applyPlan}>ยืนยัน</button><button style={btn} onClick={() => setPlan(null)}>ยกเลิก</button></div>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            {unscheduled.map((c) => <button key={c.id} onClick={() => pick(c)} style={{ ...btn, display: "block", width: "100%", textAlign: "left", marginBottom: 4, fontSize: 12 }}>{c.title}</button>)}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- คิดไอเดีย ---------------- */
function Ideas({ items, brand, saveBrand, reload, toScript }: { items: Campaign[]; brand: string; saveBrand: (v: string) => void; reload: () => void; toScript: (i: Idea, id: string | null) => void }) {
  const [channel, setChannel] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Idea[]>([]);
  const [saved, setSaved] = useState<Record<number, string>>({});

  const gen = async () => {
    setBusy(true); setErr(""); setSaved({});
    const { ok, data } = await api<{ items: Idea[] }>("/api/marketing/ai", { method: "POST", body: JSON.stringify({ mode: "ideas", brand, channel, formats, count, theme, existing: items.map((c) => c.title) }) });
    if (ok) setRes(data.items); else setErr(data.error ?? "สร้างไม่สำเร็จ");
    setBusy(false);
  };
  const save = async (i: Idea, idx: number): Promise<string | null> => {
    if (saved[idx]) return saved[idx];
    const { ok, data } = await api<{ campaign: { id: string } }>("/api/marketing", { method: "POST", body: JSON.stringify({ title: i.title, contentType: typeOf(i.format), channels: i.channels, status: "ไอเดีย", notes: `รูปแบบ: ${i.format}\nฮุก: ${i.hook}\nทำไมน่าดู: ${i.why}` }) });
    if (!ok) { setErr(data.error ?? "บันทึกไม่สำเร็จ"); return null; }
    setSaved((s) => ({ ...s, [idx]: data.campaign.id })); await reload();
    return data.campaign.id;
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <section style={{ ...card, flex: "1 1 320px" }}>
        <label style={lab}>ข้อมูลร้านที่ AI ใช้ (แก้ได้ จำไว้ในเครื่องนี้)</label>
        <textarea style={{ ...input, minHeight: 130 }} value={brand} onChange={(e) => saveBrand(e.target.value)} />
        <label style={{ ...lab, marginTop: 10 }}>เทรนด์ เสียง หรือเหตุการณ์ที่คุณเห็นช่วงนี้</label>
        <textarea style={{ ...input, minHeight: 64 }} placeholder="เช่น เสียงที่ฮิตใน TikTok, วันหยุดยาวที่จะถึง, เมนูใหม่" value={theme} onChange={(e) => setTheme(e.target.value)} />
        <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>AI ไม่เห็นเทรนด์ปัจจุบัน ถ้าไม่ใส่ จะได้ไอเดียที่ไม่ผูกกับเทรนด์</p>
        <label style={{ ...lab, marginTop: 10 }}>ช่องทางที่เน้น</label>
        <select style={input} value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">ทุกช่องทาง</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
        <label style={{ ...lab, marginTop: 10 }}>รูปแบบ (ไม่เลือก = ผสม)</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FORMATS.map((f) => { const on = formats.includes(f); return <button key={f} aria-pressed={on} onClick={() => setFormats((a) => (on ? a.filter((x) => x !== f) : [...a, f]))} style={{ ...btn, padding: "4px 10px", fontSize: 12, background: on ? "#FFF3EE" : "#fff", borderColor: on ? RED : LINE }}>{f}</button>; })}
        </div>
        <label style={{ ...lab, marginTop: 10 }}>จำนวนไอเดีย</label>
        <select style={input} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <button style={{ ...btnP, marginTop: 12, width: "100%", opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={gen}>{busy ? "กำลังคิด…" : "✨ คิดไอเดีย"}</button>
        {err && <p role="alert" style={{ color: RED, fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
      </section>

      <div style={{ flex: "2 1 420px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        {res.length === 0 && !busy && <p style={{ color: MUTED, fontSize: 14 }}>กด “คิดไอเดีย” แล้วไอเดียจะขึ้นที่นี่ บันทึกอันที่ชอบเป็นสถานะ “ไอเดีย” เข้าตารางแคมเปญได้เลย</p>}
        {res.map((i, idx) => (
          <article key={idx} style={card}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>{i.title}</strong>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#EEEDFE", color: "#3C3489" }}>{i.format}</span>
              {i.effort && <span style={{ fontSize: 11, color: MUTED }}>งาน{i.effort}</span>}
            </div>
            <p style={{ margin: "8px 0 2px", fontSize: 13 }}><b>ฮุก:</b> {i.hook}</p>
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{i.why}</p>
            {i.channels.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>ช่องทาง: {i.channels.join(", ")}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button style={btn} disabled={!!saved[idx]} onClick={() => save(i, idx)}>{saved[idx] ? "✓ บันทึกแล้ว" : "บันทึกเป็นไอเดีย"}</button>
              <button style={btn} onClick={async () => toScript(i, await save(i, idx))}>✍️ ทำสคริปต์</button>
              {i.format === "พิกัดร้าน" && <a href="/marketing/studio" style={{ ...btn, textDecoration: "none", color: "#1a1a18" }}>🎬 เปิด Studio</a>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------------- ออกแบบสคริปต์ ---------------- */
function ScriptDesigner({ brand, draft, setDraft, reload }: { brand: string; draft: Draft; setDraft: (d: Draft) => void; reload: () => void }) {
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sc, setSc] = useState<Script | null>(null);
  const [msg, setMsg] = useState("");
  const set = (p: Partial<Draft>) => { setDraft({ ...draft, ...p }); };

  const gen = async () => {
    setBusy(true); setErr(""); setMsg("");
    const { ok, data } = await api<{ script: Script }>("/api/marketing/ai", { method: "POST", body: JSON.stringify({ mode: "script", brand, title: draft.title, format: draft.format, duration, channel: draft.channel, notes: draft.notes }) });
    if (ok) setSc(data.script); else setErr(data.error ?? "สร้างไม่สำเร็จ");
    setBusy(false);
  };
  const copy = async () => { if (!sc) return; try { await navigator.clipboard.writeText(scriptText(draft, sc)); setMsg("คัดลอกแล้ว"); } catch { setMsg("คัดลอกไม่ได้ เลือกข้อความแล้วคัดลอกเอง"); } };
  const save = async () => {
    if (!sc) return;
    const text = scriptText(draft, sc); setBusy(true);
    const r = draft.campaignId
      ? await api(`/api/marketing/${draft.campaignId}`, { method: "PATCH", body: JSON.stringify({ notes: text, status: "กำลังสร้าง" }) })
      : await api<{ campaign: { id: string } }>("/api/marketing", { method: "POST", body: JSON.stringify({ title: draft.title, contentType: typeOf(draft.format), status: "กำลังสร้าง", channels: draft.channel ? [draft.channel] : [], notes: text }) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error ?? "บันทึกไม่สำเร็จ"); return; }
    if (!draft.campaignId && "campaign" in r.data) setDraft({ ...draft, campaignId: (r.data as { campaign: { id: string } }).campaign.id });
    setMsg("บันทึกสคริปต์เข้าแคมเปญแล้ว สถานะ “กำลังสร้าง”"); await reload();
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <section style={{ ...card, flex: "1 1 320px" }}>
        <label style={lab}>ชื่อคอนเทนต์ *</label>
        <input style={input} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="เช่น พิกัดร้านไก่ทอดนั่งแอร์" />
        <label style={{ ...lab, marginTop: 10 }}>รูปแบบ</label>
        <select style={input} value={draft.format} onChange={(e) => set({ format: e.target.value })}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
        <label style={{ ...lab, marginTop: 10 }}>ความยาว</label>
        <select style={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} วินาที</option>)}</select>
        <label style={{ ...lab, marginTop: 10 }}>ช่องทาง</label>
        <select style={input} value={draft.channel} onChange={(e) => set({ channel: e.target.value })}><option value="">ทุกช่องทาง</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
        <label style={{ ...lab, marginTop: 10 }}>ข้อมูลที่ต้องใส่ในคลิป (ราคา เมนู โปร ที่อยู่)</label>
        <textarea style={{ ...input, minHeight: 90 }} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>สิ่งที่ไม่ได้กรอก AI จะเว้นเป็น [ใส่…] ไม่แต่งเอง</p>
        <button style={{ ...btnP, marginTop: 12, width: "100%", opacity: busy || !draft.title.trim() ? 0.6 : 1 }} disabled={busy || !draft.title.trim()} onClick={gen}>{busy ? "กำลังเขียน…" : "✨ เขียนสคริปต์"}</button>
        {err && <p role="alert" style={{ color: RED, fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
      </section>

      <section style={{ ...card, flex: "2 1 420px", minWidth: 0 }}>
        {!sc && <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>กรอกโจทย์ทางซ้ายแล้วกด “เขียนสคริปต์” ผลจะเป็นฮุก ตารางช็อต แคปชัน แฮชแท็ก และรายการของที่ต้องเตรียม</p>}
        {sc && (
          <div style={{ fontSize: 14 }}>
            <p style={{ margin: "0 0 10px" }}><b>ฮุก:</b> {sc.hook}</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", color: MUTED }}><th style={{ padding: 4 }}>วิ</th><th style={{ padding: 4 }}>ภาพ</th><th style={{ padding: 4 }}>ข้อความบนจอ</th><th style={{ padding: 4 }}>เสียง</th></tr></thead>
                <tbody>{sc.shots.map((s, i) => <tr key={i} style={{ borderTop: `1px solid ${LINE}`, verticalAlign: "top" }}><td style={{ padding: 4, whiteSpace: "nowrap" }}>{s.t}</td><td style={{ padding: 4 }}>{s.visual}</td><td style={{ padding: 4, fontWeight: 600 }}>{s.onscreen}</td><td style={{ padding: 4 }}>{s.voice}</td></tr>)}</tbody>
              </table>
            </div>
            <p style={{ margin: "12px 0 2px" }}><b>CTA:</b> {sc.cta}</p>
            <p style={{ margin: "10px 0 2px" }}><b>แคปชัน</b></p>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#faf9f5", borderRadius: 8, padding: 8, fontFamily: "inherit", fontSize: 13 }}>{sc.caption}{"\n"}{sc.hashtags.join(" ")}</pre>
            {sc.props.length > 0 && <p style={{ margin: "10px 0 0", fontSize: 13 }}><b>เตรียมของ:</b> {sc.props.join(", ")}</p>}
            {sc.tips.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 13 }}>{sc.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <button style={btnP} disabled={busy} onClick={save}>{draft.campaignId ? "บันทึกเข้าแคมเปญเดิม" : "บันทึกเป็นแคมเปญใหม่"}</button>
              <button style={btn} onClick={copy}>คัดลอก</button>
              <button style={btn} disabled={busy} onClick={gen}>เขียนใหม่</button>
              {draft.format === "พิกัดร้าน" && <a href="/marketing/studio" style={{ ...btn, textDecoration: "none", color: "#1a1a18" }}>🎬 ไปทำคลิปใน Studio</a>}
            </div>
            {msg && <p role="status" style={{ margin: "8px 0 0", fontSize: 13, color: "#27500A" }}>{msg}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
