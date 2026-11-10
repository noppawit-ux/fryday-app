"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

/* ---------- แท็บ บันทึกผล · ถามลูกค้า · นำเข้าแผน (จากไฟล์ Fryday_Content_System.xlsx) ---------- */

type Api = <T>(url: string, init?: RequestInit) => Promise<{ ok: boolean; data: T & { error?: string } }>;
export interface Shared { card: CSSProperties; input: CSSProperties; btn: CSSProperties; btnP: CSSProperties; lab: CSSProperties; RED: string; MUTED: string; LINE: string; api: Api }

const CHANNELS = ["TikTok", "Instagram Reels", "Facebook Reels", "YouTube Shorts"];
const METRICS: [string, string][] = [["views", "Views/Reach"], ["likes", "Likes"], ["comments", "Comments"], ["shares", "Shares"], ["saves", "Saves"], ["profile_visits", "เข้าโปรไฟล์"], ["new_followers", "ผู้ติดตามใหม่"]];
const SURVEY: [string, string][] = [["tiktok", "TikTok"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["friend", "เพื่อนบอก"], ["passby", "ผ่านหน้าร้าน"], ["other", "อื่นๆ"]];
const PLAN_START = "2026-11-02";

type Vals = Record<string, number | null | undefined> & { captured_on?: string | null };
interface Clip { id: string; title: string; pillar: string; status: string; postDate: string | null; week: number; results: Record<string, Vals> }
interface Agg { views: number; shares: number; saves: number; profile: number; followers: number; shareSave: number; shareSavePct: number | null }
interface Summary {
  weekly: (Agg & { week: number; theme: string; asked: number; fromClip: number; fromClipPct: number | null })[];
  pillars: (Agg & { pillar: string; posted: number; avgViews: number | null })[];
  channels: (Agg & { channel: string })[];
  top: { title: string; channel: string; views: number } | null; bestPillar: string | null;
}
interface SurveyRow { week_start: string; [k: string]: number | string }
interface Res { clips: Clip[]; survey: SurveyRow[]; summary: Summary }

const pct = (v: number | null) => (v === null ? "–" : (v * 100).toFixed(1) + "%");
const num = (v: number | null) => (v === null ? "–" : Math.round(v).toLocaleString("th-TH"));
const todayStr = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const weekOfToday = () => Math.min(4, Math.max(1, Math.floor((Date.parse(todayStr()) - Date.parse(PLAN_START)) / 86400000 / 7) + 1));

/* เรียก API ที่ต้องล็อกอิน: ถ้า 401 ให้ขอรหัสผ่านเดียวกับหน้า Roadmap */
function useAuthCall(S: Shared) {
  const [need, setNeed] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const call = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "เชื่อมต่อไม่ได้" };
    if (res?.status === 401) { setNeed(true); return null; }
    if (!res?.ok) { setErr(data.error ?? "ไม่สำเร็จ"); return null; }
    setNeed(false); setErr(""); return data;
  };
  const loginBox = (retry: () => void) => need && (
    <div style={{ marginTop: 10 }}>
      <label style={S.lab}>ต้องใส่รหัสผ่านเดียวกับหน้า Roadmap</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="password" style={S.input} value={pw} onChange={(e) => setPw(e.target.value)} />
        <button style={S.btnP} onClick={async () => {
          const r = await fetch("/api/roadmap/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null);
          if (r?.ok) { setPw(""); retry(); } else setErr("รหัสผ่านไม่ถูกต้อง");
        }}>เข้าสู่ระบบ</button>
      </div>
    </div>
  );
  return { call, loginBox, err, setErr };
}

/* ---------------- นำเข้าแผน 16 คลิป ---------------- */
export function ImportPlan({ reload, shared: S }: { reload: () => void; shared: Shared }) {
  const { call, loginBox, err } = useAuthCall(S);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    setBusy(true); setMsg("");
    const d = await call("/api/marketing/seed-plan", { method: "POST" });
    if (d) { setMsg(`นำเข้าแล้ว ${d.created} คลิป (ข้ามที่มีอยู่ ${d.skipped})`); reload(); }
    setBusy(false);
  };
  return (
    <section style={{ ...S.card, marginBottom: 12, background: "#FFF8F5" }}>
      <strong style={{ fontSize: 14 }}>📥 แผนคอนเทนต์ 2–29 พ.ย. (16 คลิป) ยังไม่ครบในปฏิทิน</strong>
      <p style={{ margin: "4px 0 8px", fontSize: 13, color: S.MUTED }}>นำเข้าจากไฟล์ Fryday_Content_System: ชื่อคลิป วันโพสต์ เสาหลัก 4 ช่อง และฮุก/ช็อต/แคปชัน/แฮชแท็กในโน้ต กดซ้ำได้ ไม่สร้างเบิ้ล</p>
      <button style={{ ...S.btnP, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={go}>{busy ? "กำลังนำเข้า…" : "นำเข้าแผน 16 คลิป"}</button>
      {loginBox(go)}
      {msg && <p style={{ fontSize: 13, color: "#27500A", margin: "8px 0 0" }}>✓ {msg}</p>}
      {err && <p role="alert" style={{ fontSize: 13, color: S.RED, margin: "8px 0 0" }}>❌ {err}</p>}
    </section>
  );
}

/* ---------------- บันทึกผล ---------------- */
export function Results({ reload, shared: S }: { reload: () => void; shared: Shared }) {
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { ok, data } = await S.api<Res>("/api/marketing/results");
    if (ok) { setRes(data); setErr(""); } else setErr(data.error ?? "โหลดผลไม่สำเร็จ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { queueMicrotask(load); }, [load]);

  const th: CSSProperties = { textAlign: "right", padding: "6px 8px", fontSize: 12, color: S.MUTED, fontWeight: 500, whiteSpace: "nowrap" };
  const td: CSSProperties = { textAlign: "right", padding: "6px 8px", fontSize: 13, whiteSpace: "nowrap" };
  const tl: CSSProperties = { ...td, textAlign: "left" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && <p role="alert" style={{ color: S.RED, fontSize: 14 }}>❌ {err}</p>}
      {!res && !err && <p style={{ color: S.MUTED, fontSize: 14 }}>กำลังโหลด…</p>}
      {res && res.clips.length === 0 && <p style={{ ...S.card, fontSize: 14 }}>ยังไม่มีคลิปที่ติดเสาหลัก ไปแท็บ “ปฏิทิน” แล้วกด “นำเข้าแผน 16 คลิป” ก่อน</p>}
      {res && res.clips.length > 0 && (<>
        <section style={S.card}>
          <strong style={{ fontSize: 14 }}>สรุปรายสัปดาห์</strong>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>สัปดาห์</th><th style={th}>Views</th><th style={th}>Shares+Saves</th><th style={th}>Share+Save %</th><th style={th}>เข้าโปรไฟล์</th><th style={th}>ผู้ติดตามใหม่</th><th style={th}>ลูกค้ารู้จักจากคลิป</th></tr></thead>
              <tbody>{res.summary.weekly.map((w) => (
                <tr key={w.week} style={{ borderTop: `0.5px solid ${S.LINE}` }}>
                  <td style={tl} title={w.theme}>สัปดาห์ {w.week}</td><td style={td}>{num(w.views)}</td><td style={td}>{num(w.shareSave)}</td><td style={td}>{pct(w.shareSavePct)}</td><td style={td}>{num(w.profile)}</td><td style={td}>{num(w.followers)}</td><td style={td}>{w.fromClip}/{w.asked} ({pct(w.fromClipPct)})</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <section style={{ ...S.card, flex: "1 1 340px", minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>ตามเสาหลัก</strong>
            <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>เสาหลัก</th><th style={th}>โพสต์</th><th style={th}>Views เฉลี่ย</th><th style={th}>Share+Save %</th></tr></thead>
              <tbody>{res.summary.pillars.map((p) => (
                <tr key={p.pillar} style={{ borderTop: `0.5px solid ${S.LINE}`, background: p.pillar === res.summary.bestPillar ? "#EAF3DE" : undefined }}>
                  <td style={tl}>{p.pillar}</td><td style={td}>{p.posted}</td><td style={td}>{num(p.avgViews)}</td><td style={td}>{pct(p.shareSavePct)}</td></tr>))}</tbody>
            </table></div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: S.MUTED }}>เสาหลักที่ views เฉลี่ยสูงสุด: {res.summary.bestPillar ?? "ยังไม่มีข้อมูล"} (เฉลี่ยคิดจากคลิปที่ตั้งสถานะ “โพสต์แล้ว”)</p>
          </section>
          <section style={{ ...S.card, flex: "1 1 340px", minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>ตามช่อง</strong>
            <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>ช่อง</th><th style={th}>Views</th><th style={th}>ติดตามใหม่</th><th style={th}>Share+Save %</th></tr></thead>
              <tbody>{res.summary.channels.map((c) => (
                <tr key={c.channel} style={{ borderTop: `0.5px solid ${S.LINE}` }}><td style={tl}>{c.channel}</td><td style={td}>{num(c.views)}</td><td style={td}>{num(c.followers)}</td><td style={td}>{pct(c.shareSavePct)}</td></tr>))}</tbody>
            </table></div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: S.MUTED }}>คลิป views สูงสุด: {res.summary.top ? `${res.summary.top.title} [${res.summary.top.channel}] ${num(res.summary.top.views)}` : "ยังไม่มีข้อมูล"}</p>
          </section>
        </div>

        <AiReview S={S} />

        <section style={S.card}>
          <strong style={{ fontSize: 14 }}>กรอกผลรายคลิป (ทุกวันจันทร์ ดูจากสถิติของแต่ละแอป)</strong>
          <p style={{ margin: "2px 0 10px", fontSize: 12, color: S.MUTED }}>กรอกเฉพาะช่องที่โพสต์แล้ว เว้นว่างได้ แล้วกด “บันทึก” ของช่องนั้น</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {res.clips.map((c) => {
              const filled = Object.keys(c.results).length;
              return (
                <div key={c.id} style={{ border: `0.5px solid ${S.LINE}`, borderRadius: 10 }}>
                  <button onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} style={{ ...S.btn, width: "100%", textAlign: "left", border: "none", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>{c.title}</span>
                    <span style={{ fontSize: 11, color: S.MUTED }}>{c.pillar} · {c.postDate?.slice(5, 10) ?? "ยังไม่กำหนดวัน"} · {c.status}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: filled ? "#27500A" : S.MUTED }}>{filled ? `กรอกแล้ว ${filled}/4 ช่อง` : "ยังไม่กรอก"}</span>
                  </button>
                  {open === c.id && <ClipForm clip={c} S={S} onSaved={() => { load(); reload(); }} />}
                </div>
              );
            })}
          </div>
        </section>
      </>)}
    </div>
  );
}

function ClipForm({ clip, S, onSaved }: { clip: Clip; S: Shared; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(CHANNELS.map((ch) => [ch, Object.fromEntries(METRICS.map(([k]) => [k, clip.results[ch]?.[k] == null ? "" : String(clip.results[ch][k])]))])));
  const [msg, setMsg] = useState<Record<string, string>>({});
  const save = async (ch: string) => {
    setMsg((m) => ({ ...m, [ch]: "กำลังบันทึก…" }));
    const values = Object.fromEntries(METRICS.map(([k]) => [k, vals[ch][k] === "" ? null : Number(vals[ch][k])]));
    const { ok, data } = await S.api("/api/marketing/results", { method: "PUT", body: JSON.stringify({ campaignId: clip.id, channel: ch, values, capturedOn: todayStr() }) });
    setMsg((m) => ({ ...m, [ch]: ok ? "✓ บันทึกแล้ว" : `❌ ${data.error ?? "ไม่สำเร็จ"}` }));
    if (ok) onSaved();
  };
  return (
    <div style={{ padding: "4px 12px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
      {CHANNELS.map((ch) => (
        <div key={ch} style={{ border: `0.5px solid ${S.LINE}`, borderRadius: 8, padding: 10 }}>
          <strong style={{ fontSize: 13 }}>{ch}</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            {METRICS.map(([k, label]) => (
              <label key={k} style={{ fontSize: 11, color: S.MUTED }}>{label}
                <input type="number" inputMode="numeric" min={0} style={{ ...S.input, padding: "5px 8px", fontSize: 13 }} value={vals[ch][k]} onChange={(e) => setVals((v) => ({ ...v, [ch]: { ...v[ch], [k]: e.target.value } }))} />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button style={S.btnP} onClick={() => save(ch)}>บันทึก</button>
            <span style={{ fontSize: 12, color: msg[ch]?.startsWith("❌") ? S.RED : S.MUTED }}>{msg[ch]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- AI ร่างสรุป ทำต่อ/เลิก/ลองใหม่ ---------------- */
function AiReview({ S }: { S: Shared }) {
  const { call, loginBox, err } = useAuthCall(S);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ used: number; r: { summary: string; keep: string; drop: string; tryNew: string; gaps: string[] } } | null>(null);
  const run = async () => {
    setBusy(true);
    const d = await call("/api/marketing/analyze", { method: "POST", body: JSON.stringify({ mode: "content" }) });
    if (d) setOut({ used: d.clipsUsed, r: d.result });
    setBusy(false);
  };
  const row = (label: string, v: string, bg: string) => v ? <p style={{ margin: "6px 0 0", fontSize: 13, background: bg, padding: "8px 10px", borderRadius: 8 }}><b>{label}:</b> {v}</p> : null;
  return (
    <section style={S.card}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>🤖 ให้ AI ร่างสรุปจากผลจริง</strong>
        <button style={{ ...S.btnP, marginLeft: "auto", opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={run}>{busy ? "กำลังวิเคราะห์…" : "ร่าง ทำต่อ / เลิก / ลองใหม่"}</button>
      </div>
      {loginBox(run)}
      {err && <p role="alert" style={{ fontSize: 13, color: S.RED, margin: "8px 0 0" }}>❌ {err}</p>}
      {out && (<div style={{ marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: S.MUTED }}>ใช้ผลจาก {out.used} คลิป · เป็นร่างให้ครูตัดสินใจเอง</p>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>{out.r.summary}</p>
        {row("ทำต่อ", out.r.keep, "#EAF3DE")}{row("เลิก", out.r.drop, "#FCEBEB")}{row("ลองใหม่", out.r.tryNew, "#E6F1FB")}
        {out.r.gaps.length > 0 && <ul style={{ fontSize: 12, color: S.MUTED, margin: "8px 0 0", paddingLeft: 18 }}>{out.r.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>}
      </div>)}
    </section>
  );
}

/* ---------------- ถามลูกค้า ---------------- */
export function Survey({ shared: S }: { shared: Shared }) {
  const [res, setRes] = useState<Res | null>(null);
  const [week, setWeek] = useState(weekOfToday);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { ok, data } = await S.api<Res>("/api/marketing/results");
    if (ok) setRes(data); else setErr(data.error ?? "โหลดไม่สำเร็จ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { queueMicrotask(load); }, [load]);

  const wsOf = (w: number) => new Date(Date.parse(PLAN_START + "T00:00:00Z") + (w - 1) * 7 * 86400000).toISOString().slice(0, 10);
  const cur = res?.survey.find((r) => r.week_start === wsOf(week));
  const bump = async (field: string, delta: number) => {
    setBusy(true); setErr("");
    const { ok, data } = await S.api("/api/marketing/results", { method: "POST", body: JSON.stringify({ week, field, delta }) });
    if (!ok) setErr(data.error ?? "บันทึกไม่สำเร็จ");
    await load(); setBusy(false);
  };
  const total = SURVEY.reduce((t, [k]) => t + Number(cur?.[k] ?? 0), 0);
  const fromClip = ["tiktok", "instagram", "facebook", "youtube"].reduce((t, k) => t + Number(cur?.[k] ?? 0), 0);

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
      <section style={{ ...S.card, flex: "1 1 340px" }}>
        <strong style={{ fontSize: 15 }}>“รู้จักร้านเราจากไหนคะ/ครับ?”</strong>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: S.MUTED }}>ถามลูกค้าหน้าร้าน แล้วกด + ตามคำตอบ นับเป็นจำนวนคน (ไม่ใช่จำนวนครั้ง) นับเฉพาะคนที่ตอบ</p>
        <label style={S.lab}>สัปดาห์</label>
        <select style={S.input} value={week} onChange={(e) => setWeek(Number(e.target.value))}>{[1, 2, 3, 4].map((w) => <option key={w} value={w}>สัปดาห์ {w} (เริ่ม {wsOf(w).slice(5)})</option>)}</select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {SURVEY.map(([k, label]) => (
            <div key={k} style={{ border: `0.5px solid ${S.LINE}`, borderRadius: 10, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: S.MUTED }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{Number(cur?.[k] ?? 0)}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                <button aria-label={`ลด ${label}`} style={{ ...S.btn, minWidth: 40 }} disabled={busy || !Number(cur?.[k] ?? 0)} onClick={() => bump(k, -1)}>−</button>
                <button aria-label={`เพิ่ม ${label}`} style={{ ...S.btnP, minWidth: 56 }} disabled={busy} onClick={() => bump(k, 1)}>+1</button>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 14 }}>รวมที่ถาม <b>{total}</b> คน · รู้จักจากคลิป (4 ช่อง) <b>{fromClip}</b> คน ({total ? pct(fromClip / total) : "–"})</p>
        {err && <p role="alert" style={{ color: S.RED, fontSize: 13 }}>❌ {err}</p>}
      </section>
      <section style={{ ...S.card, flex: "1 1 320px", minWidth: 0 }}>
        <strong style={{ fontSize: 14 }}>สรุปรายสัปดาห์</strong>
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 360 }}>
          <thead><tr>{["สัปดาห์", "รวมที่ถาม", "จากคลิป", "%"].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "6px 8px", fontSize: 12, color: S.MUTED, fontWeight: 500 }}>{h}</th>)}</tr></thead>
          <tbody>{(res?.summary.weekly ?? []).map((w) => (
            <tr key={w.week} style={{ borderTop: `0.5px solid ${S.LINE}` }}>
              <td style={{ padding: "6px 8px", fontSize: 13 }}>สัปดาห์ {w.week}</td><td style={{ padding: "6px 8px", fontSize: 13, textAlign: "right" }}>{w.asked}</td>
              <td style={{ padding: "6px 8px", fontSize: 13, textAlign: "right" }}>{w.fromClip}</td><td style={{ padding: "6px 8px", fontSize: 13, textAlign: "right" }}>{pct(w.fromClipPct)}</td>
            </tr>))}</tbody>
        </table></div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: S.MUTED }}>ตัวเลขนี้คือหลักฐาน awareness ที่เชื่อถือได้สุดของร้านท้องถิ่น และจะถูกส่งให้ AI ในแท็บ “บันทึกผล” ด้วย</p>
      </section>
    </div>
  );
}
