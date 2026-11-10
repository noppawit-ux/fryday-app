"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ImportPlan, Results, Survey } from "./results";
import "./planner.css";
import { buildIcs, downloadIcs } from "./ics";

/* ---------- วางแผนคอนเทนต์: ปฏิทิน · ไอเดีย · สคริปต์ ----------
   ใช้ข้อมูลชุดเดียวกับหน้า Marketing (ตารางแคมเปญใน Notion) */

interface Campaign { id: string; title: string; contentType: string | null; channels: string[]; status: string; postDate: string | null; link: string | null; reach?: number; engagement?: number; salesIncrease?: number }
interface Idea { title: string; format: string; channels: string[]; pillar?: string; hook: string; why: string; effort: string }
interface Shot { t: string; visual: string; onscreen: string; voice: string }
interface Script { hook: string; shots: Shot[]; caption: string; hashtags: string[]; cta: string; props: string[]; tips: string[] }
interface Draft { title: string; format: string; channel: string; notes: string; campaignId: string | null }

const RED = "#C0200A", MUTED = "#73726c", LINE = "#E7E2D6";
const STATUS = ["ไอเดีย", "ยังไม่ถ่าย", "ถ่ายแล้ว", "ตัดต่อแล้ว", "ตั้งเวลาแล้ว", "กำลังสร้าง", "รออนุมัติ", "โพสต์แล้ว", "วัดผล"];
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  ไอเดีย: { bg: "#F1EFE8", fg: "#5F5E5A" }, กำลังสร้าง: { bg: "#FAEEDA", fg: "#854F0B" }, รออนุมัติ: { bg: "#E6F1FB", fg: "#185FA5" },
  โพสต์แล้ว: { bg: "#EAF3DE", fg: "#27500A" }, วัดผล: { bg: "#EEEDFE", fg: "#3C3489" },
  ยังไม่ถ่าย: { bg: "#F1EFE8", fg: "#5F5E5A" }, ถ่ายแล้ว: { bg: "#FAEEDA", fg: "#854F0B" }, ตัดต่อแล้ว: { bg: "#FBEAF0", fg: "#72243E" }, ตั้งเวลาแล้ว: { bg: "#E6F1FB", fg: "#185FA5" },
};
const PILLARS = ["ภาพอาหาร", "เบื้องหลังร้าน", "จุดต่างของร้าน", "คน/บรรยากาศ"];
const FORMATS = ["พิกัดร้าน", "เมนู/ASMR", "เบื้องหลังครัว", "บอร์ดเกมในร้าน", "โปรโมชัน", "ถาม-ตอบ/โพล", "ตามเทรนด์", "รีวิวลูกค้า"];
const CHANNELS = ["Facebook", "Instagram", "TikTok", "YouTube Shorts", "Instagram Reels", "Facebook Reels"];
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const BRAND_KEY = "fryday-planner-brand-v1";
const DEFAULT_BRAND = `Fryday ร้านไก่ทอด
จุดขาย: นั่งแอร์ได้ มีบอร์ดเกมให้เล่นในร้าน
ที่ตั้ง: ติด 3 แยกไฟแดง หลังโรงเรียนสตรีราชินูทิศ
ปิดทุกวันพฤหัสบดี (เริ่ม 12 พ.ย. 2569)
ช่องทางที่มี: Facebook Page, Instagram Reels, TikTok, YouTube Shorts`;

const card: CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 };
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
  const [tab, setTab] = useState<"cal" | "insight" | "ideas" | "script" | "results" | "survey">("cal");
  const [theme, setTheme] = useState("");
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
    <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}>{label}</button>
  );

  return (
    <main className="pl" style={{ padding: "20px 20px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="pl-head">
        <div>
          <a href="/marketing" className="pl-back">← กลับหน้า Marketing</a>
          <h1>วางแผนคอนเทนต์</h1>
          <p>แผน 2–29 พ.ย. · ถ่ายสัปดาห์ละครั้ง ลง 4 ช่อง แล้วดูผลทุกวันจันทร์</p>
        </div>
        <a href="/marketing/studio" style={{ ...btn, marginLeft: "auto", textDecoration: "none", color: "#2a2118", fontWeight: 600 }}>🎬 Studio ทำคลิป</a>
      </div>

      <Pipeline items={items} />

      <nav className="pl-nav" aria-label="เมนูวางแผนคอนเทนต์">
        <div className="pl-group"><span>วางแผน</span><div className="pl-seg">{tabBtn("cal", "ปฏิทิน")}{tabBtn("ideas", "คิดไอเดีย")}{tabBtn("script", "ออกแบบสคริปต์")}</div></div>
        <div className="pl-group"><span>วัดผล</span><div className="pl-seg">{tabBtn("results", "บันทึกผล")}{tabBtn("survey", "ถามลูกค้า")}{tabBtn("insight", "วิเคราะห์ข้อมูล")}</div></div>
      </nav>
      {err && <p role="alert" style={{ color: RED, fontSize: 14 }}>❌ {err}</p>}
      {loading && <p style={{ color: MUTED, fontSize: 14 }}>กำลังโหลด…</p>}

      {tab === "cal" && items.filter((c) => /^คลิป \d+:/.test(c.title)).length < 16 && <ImportPlan reload={load} shared={{ card, input, btn, btnP, lab, RED, MUTED, LINE, api }} />}
      {tab === "cal" && <Calendar items={items} reload={load} toScript={(c) => { setDraft({ title: c.title, format: "พิกัดร้าน", channel: "", notes: "", campaignId: c.id }); setTab("script"); }} />}
      {tab === "insight" && <Insights items={items} toIdeas={(t) => { setTheme(t); setTab("ideas"); }} />}
      {tab === "ideas" && <Ideas items={items} theme={theme} setTheme={setTheme} brand={brand} saveBrand={saveBrand} reload={load} toScript={(i, id) => { setDraft({ title: i.title, format: i.format, channel: i.channels[0] ?? "", notes: `ฮุกที่คิดไว้: ${i.hook}`, campaignId: id }); setTab("script"); }} />}
      {tab === "results" && <Results reload={load} shared={{ card, input, btn, btnP, lab, RED, MUTED, LINE, api }} />}
      {tab === "survey" && <Survey shared={{ card, input, btn, btnP, lab, RED, MUTED, LINE, api }} />}
      {tab === "script" && <ScriptDesigner brand={brand} draft={draft} setDraft={setDraft} reload={load} />}
    </main>
  );
}


/* ---------------- สายการผลิตคลิป: แต่ละคลิปค้างอยู่ขั้นไหน ---------------- */
const STAGES = ["ยังไม่ถ่าย", "ถ่ายแล้ว", "ตัดต่อแล้ว", "ตั้งเวลาแล้ว", "โพสต์แล้ว"];
const STAGE_BAR: Record<string, string> = { ยังไม่ถ่าย: "#D3CFC2", ถ่ายแล้ว: "#E0A526", ตัดต่อแล้ว: "#D4537E", ตั้งเวลาแล้ว: "#378ADD", โพสต์แล้ว: "#3B8B2E" };

function Pipeline({ items }: { items: Campaign[] }) {
  const counts = STAGES.map((s) => items.filter((c) => c.status === s).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const ideas = items.filter((c) => c.status === "ไอเดีย").length;
  const t0 = todayStr();
  const nextShoot = items.filter((c) => c.status === "ยังไม่ถ่าย" && c.postDate).sort((a, b) => a.postDate!.localeCompare(b.postDate!))[0];
  const todayPosts = items.filter((c) => c.postDate?.slice(0, 10) === t0 && c.status !== "โพสต์แล้ว" && c.status !== "วัดผล").length;
  return (
    <section className="pl-line" aria-label="สายการผลิตคลิป">
      <div className="pl-line-top">
        <strong>สายการผลิตคลิป</strong>
        <span>{total ? `${total} คลิปในสายการผลิต` : "ยังไม่มีคลิปในสายการผลิต"}{ideas ? ` · ไอเดียที่รอคัดอีก ${ideas}` : ""}</span>
      </div>
      <div className={`pl-bar${total ? "" : " empty"}`} role="img" aria-label={STAGES.map((s, i) => `${s} ${counts[i]}`).join(" ")}>
        {total ? STAGES.map((s, i) => counts[i] > 0 && <i key={s} style={{ flexGrow: counts[i], background: STAGE_BAR[s] }} />) : STAGES.map((s) => <i key={s} />)}
      </div>
      <div className="pl-stages">
        {STAGES.map((s, i) => <div key={s} className="pl-stage"><b>{counts[i]}</b>{s}</div>)}
      </div>
      <p className="pl-next">
        {todayPosts > 0 ? <>📣 วันนี้ต้องโพสต์ <b>{todayPosts}</b> คลิป · </> : null}
        {nextShoot ? <>คลิปถัดไปที่ต้องถ่าย: <b>{nextShoot.title}</b> (โพสต์ {thDate(nextShoot.postDate!.slice(0, 10))})</> : total ? "ไม่มีคลิปค้างถ่าย 🎉" : "เปิดแท็บปฏิทินแล้วกด “นำเข้าแผน 16 คลิป” เพื่อเริ่ม"}
      </p>
    </section>
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
  const [qerr, setQerr] = useState("");
  const [quick, setQuick] = useState({ title: "", format: "พิกัดร้าน" });
  const [perWeek, setPerWeek] = useState<number[]>([2, 5, 0]);
  const [plan, setPlan] = useState<{ id: string; title: string; date: string }[] | null>(null);
  const [exp, setExp] = useState(false);
  const [expOpt, setExpOpt] = useState({ posts: true, shoots: true, includeDone: false });
  const [expMsg, setExpMsg] = useState("");
  const exportIcs = () => {
    const { text, count } = buildIcs(items, expOpt);
    if (!count) { setExpMsg("ไม่มีรายการที่จะส่งออก ลองติ๊ก “รวมที่โพสต์แล้ว” หรือกำหนดวันโพสต์ก่อน"); return; }
    downloadIcs(text); setExpMsg(`สร้างไฟล์แล้ว ${count} รายการ เปิดไฟล์ที่ดาวน์โหลดเพื่อเพิ่มลงปฏิทิน`);
  };

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
    setBusy(true); setQerr("");
    const r = await api("/api/marketing", { method: "POST", body: JSON.stringify({ title: quick.title.trim(), contentType: typeOf(quick.format), status: "ไอเดีย", postDate: sel, notes: `รูปแบบ: ${quick.format}` }) });
    setBusy(false);
    if (!r.ok) { setQerr([r.data.error ?? "เพิ่มไม่สำเร็จ", (r.data as { detail?: string }).detail].filter(Boolean).join(" · ")); return; }
    setQuick((q) => ({ ...q, title: "" })); await reload();
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
          <button style={{ ...btn, fontWeight: 600 }} aria-expanded={exp} onClick={() => { setExp((v) => !v); setExpMsg(""); }}>📲 ลงปฏิทินมือถือ</button>
        </div>
        {exp && (
          <div role="group" aria-label="ส่งออกลงปฏิทินมือถือ" style={{ background: "#FBF9F3", border: `1px solid ${LINE}`, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13 }}>
            <strong>ดาวน์โหลดเป็นไฟล์ปฏิทิน (.ics)</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
              <label><input type="checkbox" checked={expOpt.posts} onChange={(e) => setExpOpt((o) => ({ ...o, posts: e.target.checked }))} /> วันโพสต์ (แจ้งเตือนก่อน 30 นาที)</label>
              <label><input type="checkbox" checked={expOpt.shoots} onChange={(e) => setExpOpt((o) => ({ ...o, shoots: e.target.checked }))} /> วันถ่ายคลิป (เฉพาะคลิปจากแผน 16 คลิป)</label>
              <label><input type="checkbox" checked={expOpt.includeDone} onChange={(e) => setExpOpt((o) => ({ ...o, includeDone: e.target.checked }))} /> รวมคลิปที่โพสต์แล้ว</label>
            </div>
            <button style={btnP} disabled={!expOpt.posts && !expOpt.shoots} onClick={exportIcs}>ดาวน์โหลดไฟล์ปฏิทิน</button>
            {expMsg && <p role="status" style={{ margin: "8px 0 0", color: expMsg.startsWith("ไม่มี") ? RED : "#27500A" }}>{expMsg}</p>}
            <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>iPhone: เปิดไฟล์แล้วกด “เพิ่มทั้งหมด” · Android: เปิดด้วย Google Calendar · นำเข้าซ้ำได้ ระบบจะอัปเดตรายการเดิม ไม่สร้างเบิ้ล</p>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {DOW.map((d) => <div key={d} style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>{d}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const list = byDate.get(c) ?? [];
            const isSel = c === sel, isToday = c === t0;
            return (
              <button key={c} onClick={() => setSel(c)} aria-pressed={isSel} aria-label={`${thDate(c)} ${list.length} โพสต์`} className={`pl-day${isSel ? " sel" : ""}${[0, 6].includes(dowOf(c)) ? " weekend" : ""}`}>
                <span className={`pl-num${isToday ? " today" : ""}`}>{Number(c.slice(8))}</span>
                {list.slice(0, 2).map((x) => { const col = STATUS_COLOR[x.status] ?? STATUS_COLOR["ไอเดีย"]; return <div key={x.id} style={{ fontSize: 10, background: col.bg, color: col.fg, borderRadius: 4, padding: "1px 4px", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.title.replace(/^คลิป (\d+):.*/, "#$1")}</div>; })}
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
          {qerr && <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: RED }}>❌ {qerr}</p>}
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
            <TaskMaker key={open.id + (open.postDate ?? "")} c={open} />
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
function Ideas({ items, theme, setTheme, brand, saveBrand, reload, toScript }: { items: Campaign[]; theme: string; setTheme: (v: string) => void; brand: string; saveBrand: (v: string) => void; reload: () => void; toScript: (i: Idea, id: string | null) => void }) {
  const [channel, setChannel] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [pillars, setPillars] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Idea[]>([]);
  const [saved, setSaved] = useState<Record<number, string>>({});

  const gen = async () => {
    setBusy(true); setErr(""); setSaved({});
    const { ok, data } = await api<{ items: Idea[] }>("/api/marketing/ai", { method: "POST", body: JSON.stringify({ mode: "ideas", brand, channel, formats, pillars, count, theme, existing: items.map((c) => c.title) }) });
    if (ok) setRes(data.items); else setErr(data.error ?? "สร้างไม่สำเร็จ");
    setBusy(false);
  };
  const save = async (i: Idea, idx: number): Promise<string | null> => {
    if (saved[idx]) return saved[idx];
    const { ok, data } = await api<{ campaign: { id: string } }>("/api/marketing", { method: "POST", body: JSON.stringify({ title: i.title, contentType: i.pillar || typeOf(i.format), channels: i.channels, status: "ไอเดีย", notes: `รูปแบบ: ${i.format}${i.pillar ? `\nเสาหลัก: ${i.pillar}` : ""}\nฮุก: ${i.hook}\nทำไมน่าดู: ${i.why}` }) });
    if (!ok) { setErr(data.error ?? "บันทึกไม่สำเร็จ"); return null; }
    setSaved((s) => ({ ...s, [idx]: data.campaign.id })); await reload();
    return data.campaign.id;
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <section style={{ ...card, flex: "1 1 320px" }}>
        <label style={lab}>ข้อมูลร้านที่ AI ใช้ (แก้ได้ จำไว้ในเครื่องนี้)</label>
        <textarea style={{ ...input, minHeight: 130 }} value={brand} onChange={(e) => saveBrand(e.target.value)} />
        <label style={{ ...lab, marginTop: 10 }}>เทรนด์ ข้อมูลยอดขาย หรือเหตุการณ์ที่อยากให้ใช้ (กด “ส่งไปคิดไอเดีย” จากแท็บวิเคราะห์จะมาใส่ที่นี่)</label>
        <textarea style={{ ...input, minHeight: 110 }} placeholder="เช่น เสียงที่ฮิตใน TikTok, วันหยุดยาวที่จะถึง, เมนูใหม่" value={theme} onChange={(e) => setTheme(e.target.value)} />
        <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>AI ไม่เห็นเทรนด์ปัจจุบัน ถ้าไม่ใส่ จะได้ไอเดียที่ไม่ผูกกับเทรนด์</p>
        <label style={{ ...lab, marginTop: 10 }}>ช่องทางที่เน้น</label>
        <select style={input} value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">ทุกช่องทาง</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
        <label style={{ ...lab, marginTop: 10 }}>รูปแบบ (ไม่เลือก = ผสม)</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FORMATS.map((f) => { const on = formats.includes(f); return <button key={f} aria-pressed={on} onClick={() => setFormats((a) => (on ? a.filter((x) => x !== f) : [...a, f]))} style={{ ...btn, padding: "4px 10px", fontSize: 12, background: on ? "#FFF3EE" : "#fff", borderColor: on ? RED : LINE }}>{f}</button>; })}
        </div>
        <label style={{ ...lab, marginTop: 10 }}>เสาหลัก 4 อันของร้าน (ไม่เลือก = ให้ AI จัดให้)</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PILLARS.map((f) => { const on = pillars.includes(f); return <button key={f} aria-pressed={on} onClick={() => setPillars((a) => (on ? a.filter((x) => x !== f) : [...a, f]))} style={{ ...btn, padding: "4px 10px", fontSize: 12, background: on ? "#FFF3EE" : "#fff", borderColor: on ? RED : LINE }}>{f}</button>; })}
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
              {i.pillar && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#EAF3DE", color: "#27500A" }}>เสา: {i.pillar}</span>}
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

/* ---------------- วิเคราะห์ข้อมูล: ยอดขายร้าน + เทรนด์จากเว็บ ---------------- */
interface SalesRes { summary: string; findings: { title: string; evidence: string; contentAngle: string; confidence: string }[]; heroMenus: { name: string; reason: string }[]; timing: { days: string[]; hours: string; reasoning: string }; ideas: { title: string; format: string; hook: string; basedOn: string }[]; gaps: string[] }
interface Src { url: string; title: string; age: string }
interface TrendRes { summary: string; trends: { name: string; what: string; evidence: string; confidence: string; useForFryday: string; sources: Src[] }[]; formats: { format: string; note: string; sources: Src[] }[]; cautions: string[]; gaps: string[] }

function Sources({ list }: { list: Src[] }) {
  return (
    <div style={{ fontSize: 12, marginTop: 6 }}>
      {list.map((x) => (
        <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "#185FA5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ↗ {x.title}{x.age ? ` · ${x.age}` : ""}
        </a>
      ))}
    </div>
  );
}

const Conf = ({ v }: { v: string }) => (v ? <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: v === "สูง" ? "#EAF3DE" : v === "ต่ำ" ? "#FCEBEB" : "#FAEEDA", color: v === "สูง" ? "#27500A" : v === "ต่ำ" ? "#A32D2D" : "#854F0B" }}>เชื่อได้{v}</span> : null);

function Insights({ items, toIdeas }: { items: Campaign[]; toIdeas: (theme: string) => void }) {
  const [need, setNeed] = useState<null | "sales" | "trends">(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<"" | "sales" | "trends">("");
  const [err, setErr] = useState("");
  const [sales, setSales] = useState<{ r: SalesRes; asOf: string; posts: number } | null>(null);
  const [trends, setTrends] = useState<{ r: TrendRes; at: string; found: number } | null>(null);
  const [channel, setChannel] = useState("");
  const [focus, setFocus] = useState("");

  const run = async (kind: "sales" | "trends") => {
    setBusy(kind); setErr(""); setNeed(null);
    const posts = items.filter((c) => c.status === "โพสต์แล้ว" || c.status === "วัดผล").map((c) => ({ title: c.title, type: c.contentType, channels: c.channels, date: c.postDate?.slice(0, 10), reach: c.reach, engagement: c.engagement, sales: c.salesIncrease }));
    const res = await fetch("/api/marketing/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "sales" ? { mode: "sales", posts } : { mode: "trends", channel, focus }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "เชื่อมต่อไม่ได้" };
    setBusy("");
    if (res?.status === 401) { setNeed(kind); return; }
    if (!res?.ok) { setErr(data.error ?? "ไม่สำเร็จ"); return; }
    if (kind === "sales") setSales({ r: data.result, asOf: data.asOf, posts: data.postsUsed }); else setTrends({ r: data.result, at: data.fetchedAt, found: data.sourcesFound });
  };
  const login = async () => {
    const res = await fetch("/api/roadmap/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && need) { setPw(""); await run(need); } else setErr(d.error ?? "เข้าสู่ระบบไม่สำเร็จ");
  };

  const toTheme = () => {
    const parts: string[] = [];
    if (sales) parts.push(`[จากยอดขายร้าน ณ ${sales.asOf}] ${sales.r.summary}`, sales.r.heroMenus.length ? `เมนูที่ควรเป็นพระเอก: ${sales.r.heroMenus.map((m) => m.name).join(", ")}` : "", sales.r.timing.days.length ? `วันที่เน้น: ${sales.r.timing.days.join(", ")}` : "");
    if (trends) parts.push(`[เทรนด์จากเว็บ] ${trends.r.trends.slice(0, 4).map((t) => `${t.name}: ${t.useForFryday}`).join(" | ")}`);
    toIdeas(parts.filter(Boolean).join("\n").slice(0, 1700));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
        วิเคราะห์ยอดขายจริงของร้านเพื่อดูว่าควรทำคลิปเมนูไหนและโพสต์เมื่อไร แล้วค้นเทรนด์วิดีโอจากเว็บพร้อมลิงก์แหล่งที่มา ทั้งสองส่วนให้ข้อมูลประกอบการตัดสินใจ ไม่รับประกันว่าคลิปจะปัง และเทรนด์ในแอป (เสียง แฮชแท็ก) ยังต้องเช็กในแอปเอง
      </p>
      {err && <p role="alert" style={{ color: RED, fontSize: 14, margin: 0 }}>{err}</p>}
      {need && (
        <section style={{ ...card, maxWidth: 380 }}>
          <p style={{ margin: "0 0 8px", fontSize: 14 }}>ส่วนนี้ใช้ข้อมูลยอดขายและค่าใช้จ่ายของ AI ใส่รหัสผ่านเดียวกับหน้า Roadmap</p>
          <input type="password" autoFocus aria-label="รหัสผ่าน" style={input} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pw && login()} />
          <button style={{ ...btnP, marginTop: 8 }} disabled={!pw} onClick={login}>เข้าสู่ระบบแล้วทำต่อ</button>
        </section>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* ยอดขาย */}
        <section style={{ ...card, flex: "1 1 440px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>📊 จากยอดขายในร้าน</h2>
            <button style={{ ...btnP, marginLeft: "auto", opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => run("sales")}>{busy === "sales" ? "กำลังวิเคราะห์…" : sales ? "วิเคราะห์ใหม่" : "วิเคราะห์ยอดขาย"}</button>
          </div>
          {!sales && busy !== "sales" && <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED }}>อ่านยอดขายล่าสุด เมนูขายดี ช่องทางหน้าร้านกับเดลิเวอรี และผลโพสต์ที่เคยบันทึกไว้ แล้วสรุปเป็นข้อเสนอทำคอนเทนต์</p>}
          {sales && (
            <div style={{ fontSize: 14, marginTop: 10 }}>
              <p style={{ margin: "0 0 10px" }}>{sales.r.summary}</p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>ข้อมูลถึง {sales.asOf} · ใช้ผลโพสต์ {sales.posts} รายการ{sales.posts < 10 ? " (น้อยเกินกว่าจะเทียบผลโพสต์ได้แน่นอน)" : ""}</p>
              {sales.r.findings.map((f, i) => (
                <div key={i} style={{ borderTop: `1px solid ${LINE}`, padding: "8px 0" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{f.title}</b><Conf v={f.confidence} /></div>
                  <div style={{ fontSize: 13, color: MUTED }}>{f.evidence}</div>
                  <div style={{ fontSize: 13 }}>→ {f.contentAngle}</div>
                </div>
              ))}
              {sales.r.heroMenus.length > 0 && <p style={{ margin: "8px 0 2px" }}><b>เมนูพระเอก</b></p>}
              {sales.r.heroMenus.map((m, i) => <div key={i} style={{ fontSize: 13 }}>• <b>{m.name}</b> {m.reason}</div>)}
              {(sales.r.timing.days.length > 0 || sales.r.timing.hours) && (
                <p style={{ margin: "10px 0 0", fontSize: 13 }}><b>จังหวะโพสต์:</b> {sales.r.timing.days.join(", ")} {sales.r.timing.hours} <span style={{ color: MUTED }}>({sales.r.timing.reasoning})</span></p>
              )}
              {sales.r.ideas.length > 0 && <p style={{ margin: "10px 0 2px" }}><b>ไอเดียจากข้อมูล</b></p>}
              {sales.r.ideas.map((i, k) => <div key={k} style={{ fontSize: 13, marginBottom: 4 }}>• {i.title} <span style={{ color: MUTED }}>({i.format}) {i.basedOn}</span></div>)}
              {sales.r.gaps.length > 0 && (
                <div style={{ marginTop: 10, background: "#FFF8E6", borderRadius: 8, padding: 8, fontSize: 12 }}>
                  <b>ข้อมูลที่ยังไม่ครบ</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{sales.r.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* เทรนด์ */}
        <section style={{ ...card, flex: "1 1 440px", minWidth: 0 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>🔎 เทรนด์วิดีโอจากเว็บ</h2>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 8 }}>
            <select style={input} aria-label="ช่องทาง" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">ทุกช่องทาง</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
            <input style={input} placeholder="เจาะเรื่อง (ไม่บังคับ) เช่น ASMR ไก่ทอด" value={focus} onChange={(e) => setFocus(e.target.value)} />
          </div>
          <button style={{ ...btnP, marginTop: 8, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => run("trends")}>{busy === "trends" ? "กำลังค้นเว็บ… (ราว 30–60 วินาที)" : trends ? "ค้นใหม่" : "ค้นเทรนด์"}</button>
          {trends && (
            <div style={{ fontSize: 14, marginTop: 10 }}>
              <p style={{ margin: "0 0 4px" }}>{trends.r.summary}</p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: MUTED }}>ค้นเมื่อ {new Date(trends.at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} · พบแหล่ง {trends.found} แห่ง แสดงเฉพาะข้อที่มีลิงก์ยืนยันได้</p>
              {trends.r.trends.length === 0 && <p style={{ color: MUTED, fontSize: 13 }}>ไม่มีเทรนด์ที่ยืนยันแหล่งได้ ลองเจาะหัวข้อให้แคบลง</p>}
              {trends.r.trends.map((t, i) => (
                <div key={i} style={{ borderTop: `1px solid ${LINE}`, padding: "8px 0" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{t.name}</b><Conf v={t.confidence} /></div>
                  <div style={{ fontSize: 13 }}>{t.what}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{t.evidence}</div>
                  <div style={{ fontSize: 13 }}>→ <b>กับ Fryday:</b> {t.useForFryday}</div>
                  <Sources list={t.sources} />
                </div>
              ))}
              {trends.r.formats.length > 0 && <p style={{ margin: "8px 0 2px" }}><b>รูปแบบที่แหล่งบอกว่าได้ผล</b></p>}
              {trends.r.formats.map((f, i) => <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>• <b>{f.format}</b> {f.note}<Sources list={f.sources} /></div>)}
              {trends.r.cautions.length > 0 && <div style={{ marginTop: 8, background: "#FFF8E6", borderRadius: 8, padding: 8, fontSize: 12 }}><b>ข้อควรระวัง</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{trends.r.cautions.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
              {trends.r.gaps.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>หาไม่เจอ: {trends.r.gaps.join(" · ")}</div>}
            </div>
          )}
        </section>
      </div>

      {(sales || trends) && (
        <div><button style={btnP} onClick={toTheme}>✨ ส่งไปคิดไอเดีย</button> <span style={{ fontSize: 12, color: MUTED }}>นำสรุปข้อมูลข้างบนไปเป็นโจทย์ในแท็บคิดไอเดีย</span></div>
      )}
    </div>
  );
}

/* ---------------- สร้างงานย่อยในหน้า Tasks จากโพสต์ ---------------- */
const STEPS = [
  { key: "prep", label: "เตรียมของ + วางช็อต", off: -3 },
  { key: "shoot", label: "ถ่ายฟุตเทจ", off: -2 },
  { key: "edit", label: "ตัดต่อ + ใส่ข้อความ/แคปชัน", off: -1 },
  { key: "post", label: "โพสต์ + ตอบคอมเมนต์", off: 0 },
];

function TaskMaker({ c }: { c: Campaign }) {
  const base = c.postDate?.slice(0, 10) ?? "";
  const [on, setOn] = useState<string[]>(STEPS.map((s) => s.key));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const t0 = todayStr();
  const dateFor = (off: number) => { const d = addDays(base, off); return d < t0 ? t0 : d; };

  if (!base) return <p style={{ margin: "12px 0 0", fontSize: 12, color: MUTED }}>ตั้งวันที่โพสต์ก่อน แล้วจะสร้างงานเตรียม ถ่าย ตัดต่อ โพสต์ ลงหน้างานให้ได้</p>;

  const create = async () => {
    setBusy(true); setErr(""); setMsg("");
    const chosen = STEPS.filter((s) => on.includes(s.key));
    let ok = 0, last = "";
    for (const s of chosen) {
      const r = await api("/api/tasks", { method: "POST", body: JSON.stringify({ name: `${s.label}: ${c.title}`.slice(0, 150), category: "การตลาด", priority: "ปานกลาง", deadline: dateFor(s.off), note: `จากแผนคอนเทนต์ · กำหนดโพสต์ ${base}` }) });
      if (r.ok) ok++; else last = [r.data.error, (r.data as { detail?: string }).detail].filter(Boolean).join(" · ");
    }
    setBusy(false);
    if (ok) { setMsg(`สร้างแล้ว ${ok} งาน`); setDone(true); }
    if (ok < chosen.length) setErr(`สร้างไม่สำเร็จ ${chosen.length - ok} งาน ${last}`);
  };

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>สร้างงานในหน้างาน</div>
      {STEPS.map((s) => (
        <label key={s.key} style={{ display: "flex", gap: 6, fontSize: 13, alignItems: "center", marginBottom: 3 }}>
          <input type="checkbox" disabled={done} checked={on.includes(s.key)} onChange={() => setOn((a) => (a.includes(s.key) ? a.filter((x) => x !== s.key) : [...a, s.key]))} />
          <span style={{ flex: 1 }}>{s.label}</span><span style={{ color: MUTED, fontSize: 11 }}>{thDate(dateFor(s.off))}</span>
        </label>
      ))}
      <button style={{ ...btnP, marginTop: 8, opacity: busy || done || !on.length ? 0.6 : 1 }} disabled={busy || done || !on.length} onClick={create}>{busy ? "กำลังสร้าง…" : done ? "สร้างแล้ว" : "สร้างงาน"}</button>
      {msg && <p role="status" style={{ margin: "6px 0 0", fontSize: 12, color: "#27500A" }}>{msg} · <a href="/tasks" style={{ color: "#185FA5" }}>ดูในหน้างาน</a></p>}
      {err && <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: RED }}>❌ {err}</p>}
    </div>
  );
}
