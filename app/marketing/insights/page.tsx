"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNELS, FIELDS, FIELD_LABEL, INTERACTION_FIELDS, TYPE_LABEL, addDays, bangkokToday, byType, dailyTotals, decodeText, delta, diffDays, isDay, rowsFromCsv, series, sumRange,
  type Channel, type CsvResult, type Field, type ImportRow, type MetricRow,
} from "@/lib/page-insights";

const ACCENT: Record<string, string> = { all: "#C0200A", TikTok: "#1a1a18", Instagram: "#C13584", Facebook: "#1877F2", YouTube: "#D93025" };
const PRESETS: [string, string][] = [["7", "7 วัน"], ["14", "14 วัน"], ["30", "30 วัน"], ["90", "90 วัน"], ["all", "ทั้งหมด"], ["custom", "กำหนดเอง"]];
type MetricKey = Field;
const CARDS: [MetricKey, string][] = [["views", "การดู"], ["viewers", "ผู้ชม"], ["interactions", "การโต้ตอบ"], ["profile_visits", "เข้าโปรไฟล์"], ["new_followers", "ผู้ติดตามใหม่"]];
const fmt = (v: number) => (v >= 10000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, "") + "K" : Math.round(v).toLocaleString("th-TH"));
const full = (v: number) => Math.round(v).toLocaleString("th-TH");
const shortDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;

export default function InsightsPage() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [preset, setPreset] = useState("30");
  const today = bangkokToday();
  const [cFrom, setCFrom] = useState(addDays(today, -29));
  const [cTo, setCTo] = useState(today);
  const [metric, setMetric] = useState<MetricKey>("views");
  const [chip, setChip] = useState<"all" | Field>("all");
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/marketing/insights", { cache: "no-store" }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) setLoadErr(d.error ?? "เชื่อมต่อไม่ได้");
    else { setRows(d.rows ?? []); setLoadErr(""); }
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(load); }, [load]);

  const earliest = useMemo(() => rows.reduce((m, r) => (r.day < m ? r.day : m), today), [rows, today]);
  const [from, to] = useMemo<[string, string]>(() => {
    if (preset === "custom") return isDay(cFrom) && isDay(cTo) && cFrom <= cTo ? [cFrom, cTo] : [addDays(today, -29), today];
    if (preset === "all") return [earliest, today];
    return [addDays(today, -(Number(preset) - 1)), today];
  }, [preset, cFrom, cTo, earliest, today]);
  const len = diffDays(from, to) + 1;
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -len);

  const days = useMemo(() => dailyTotals(rows, channel), [rows, channel]);
  const cur = useMemo(() => sumRange(days, from, to), [days, from, to]);
  const prev = useMemo(() => sumRange(days, prevFrom, prevTo), [days, prevFrom, prevTo]);
  const cs = useMemo(() => series(days, from, to, metric), [days, from, to, metric]);
  const ps = useMemo(() => (preset === "all" ? [] : series(days, prevFrom, prevTo, metric)), [days, prevFrom, prevTo, metric, preset]);
  const types = useMemo(() => byType(rows, channel, from, to), [rows, channel, from, to]);
  const chCount = useMemo(() => { const m: Record<string, number> = {}; for (const r of rows) m[r.channel] = (m[r.channel] ?? 0) + 1; return m; }, [rows]);
  const accent = ACCENT[channel];
  const empty = !loading && !loadErr && rows.length === 0;

  return (
    <div className="in">
      <style>{CSS}</style>
      <header className="in-head">
        <a href="/marketing" className="in-back">← Marketing</a>
        <div className="in-title">
          <h1>สถิติเพจ</h1>
          <p>อัปโหลดข้อมูลจากแต่ละช่องทาง แล้วดูภาพรวมตามช่วงเวลาที่เลือก</p>
        </div>
        <button className={"in-btn" + (showUpload ? " on" : "")} onClick={() => setShowUpload((v) => !v)} aria-expanded={showUpload}>
          {showUpload ? "ปิดแผงอัปโหลด" : "อัปโหลดข้อมูล"}
        </button>
      </header>

      {showUpload && <UploadPanel defaultChannel={channel === "all" ? "Instagram" : channel} onSaved={load} rows={rows} />}

      <div className="in-bar">
        <div className="in-seg" role="tablist" aria-label="ช่องทาง">
          {(["all", ...CHANNELS] as const).map((c) => (
            <button key={c} role="tab" aria-selected={channel === c} className={channel === c ? "on" : ""} style={channel === c ? { borderColor: ACCENT[c], color: ACCENT[c] } : undefined} onClick={() => setChannel(c)}>
              {c === "all" ? "ทั้งหมด" : c}{c !== "all" && chCount[c] ? <i style={{ background: ACCENT[c] }} /> : null}
            </button>
          ))}
        </div>
        <div className="in-seg" role="group" aria-label="ช่วงเวลา">
          {PRESETS.map(([k, l]) => <button key={k} className={preset === k ? "on" : ""} aria-pressed={preset === k} onClick={() => setPreset(k)}>{l}</button>)}
        </div>
      </div>
      {preset === "custom" && (
        <div className="in-custom">
          <label>ตั้งแต่ <input type="date" value={cFrom} max={cTo} onChange={(e) => setCFrom(e.target.value)} /></label>
          <label>ถึง <input type="date" value={cTo} min={cFrom} max={today} onChange={(e) => setCTo(e.target.value)} /></label>
        </div>
      )}
      <p className="in-range">{shortDay(from)} – {shortDay(to)} ({len} วัน){preset !== "all" && <> · เทียบกับ {shortDay(prevFrom)} – {shortDay(prevTo)}</>}</p>

      {loading && <p className="in-note">กำลังโหลด…</p>}
      {loadErr && <p role="alert" className="in-err">{loadErr}</p>}
      {empty && (
        <div className="in-empty">
          <strong>ยังไม่มีข้อมูลเพจ</strong>
          <p>ส่งออกสถิติรายวันจากแอป/เว็บของแต่ละช่องทาง (ไฟล์ CSV) แล้วกด “อัปโหลดข้อมูล” หรือกรอกตัวเลขรายวันเองก็ได้</p>
          <button className="in-btn on" onClick={() => setShowUpload(true)}>เริ่มอัปโหลด</button>
        </div>
      )}

      {!empty && !loading && !loadErr && (
        <>
          {!cur.has && <p className="in-note">ช่วงนี้ยังไม่มีข้อมูลของ{channel === "all" ? "ทุกช่องทาง" : channel} ลองเลือกช่วงเวลาอื่น</p>}
          <div className="in-cards">
            {CARDS.map(([k, label]) => {
              const noData = cur[k] === 0 && prev[k] === 0;
              const d = preset === "all" || noData ? null : delta(cur[k], prev[k]);
              const up = (d ?? 0) >= 0;
              return (
                <button key={k} className={"in-card" + (metric === k ? " on" : "")} style={metric === k ? { borderColor: accent } : undefined} onClick={() => setMetric(k)} aria-pressed={metric === k}>
                  <span className="in-lab">{label}</span>
                  <b>{full(cur[k])}</b>
                  <span className={"in-d " + (d === null ? "" : up ? "up" : "down")}>
                    {d === null ? (noData ? "ไม่มีข้อมูลในช่วงนี้" : preset === "all" ? "ตลอดช่วงข้อมูล" : prev.has ? "ใหม่ในช่วงนี้" : "ไม่มีช่วงก่อนหน้า") : `${up ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(1)}% จากช่วงก่อน`}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="in-panel">
            <h2>{CARDS.find((c) => c[0] === metric)?.[1]} รายวัน</h2>
            <LineChart cur={cs} prev={ps} color={accent} />
            <div className="in-leg"><span><i style={{ background: accent }} />ช่วงที่เลือก</span>{ps.length > 0 && <span><i className="dash" style={{ borderColor: accent }} />ช่วงก่อนหน้า</span>}</div>
          </section>

          <div className="in-two">
            <section className="in-panel">
              <h2>การดูตามประเภทคอนเทนต์</h2>
              {types.length === 0 ? <p className="in-note">ยังไม่มีข้อมูลแยกประเภท (ไฟล์ต้องมีคอลัมน์ประเภทคอนเทนต์ เช่น Reels / โพสต์ / สตอรี่)</p> : (
                <ul className="in-bars">
                  {(() => {
                    const total = types.reduce((s, t) => s + t.views, 0) || 1;
                    return types.map((t) => {
                      const hasSplit = t.followerViews > 0;
                      const fv = Math.min(t.followerViews, t.views);
                      return (
                        <li key={t.type}>
                          <div className="in-row"><span>{typeLabel(t.type)}</span><b>{(t.views / total * 100).toFixed(1)}%</b></div>
                          <div className="in-track" title={`${full(t.views)} ครั้ง`}>
                            <div className="in-fill" style={{ width: `${t.views / total * 100}%`, background: hasSplit ? "#e5e3db" : accent }}>
                              {hasSplit && <div style={{ width: `${t.views ? fv / t.views * 100 : 0}%`, background: accent }} />}
                            </div>
                          </div>
                          <small>{full(t.views)} ครั้ง{hasSplit && <> · ผู้ติดตาม {(fv / t.views * 100).toFixed(0)}% · ไม่ใช่ผู้ติดตาม {(100 - fv / t.views * 100).toFixed(0)}%</>}</small>
                        </li>
                      );
                    });
                  })()}
                </ul>
              )}
              {types.some((t) => t.followerViews > 0) && <div className="in-leg"><span><i style={{ background: accent }} />ผู้ติดตาม</span><span><i style={{ background: "#e5e3db" }} />ไม่ใช่ผู้ติดตาม</span></div>}
            </section>

            <section className="in-panel">
              <h2>การโต้ตอบตามประเภทคอนเทนต์</h2>
              <div className="in-chips">
                {([["all", "ทั้งหมด"], ...INTERACTION_FIELDS.map((f) => [f, FIELD_LABEL[f]])] as [string, string][]).map(([k, l]) => (
                  <button key={k} className={chip === k ? "on" : ""} style={chip === k ? { background: accent, borderColor: accent } : undefined} aria-pressed={chip === k} onClick={() => setChip(k as "all" | Field)}>{l}</button>
                ))}
              </div>
              {types.length === 0 ? <p className="in-note">ยังไม่มีข้อมูลแยกประเภท</p> : (() => {
                const val = (t: (typeof types)[number]) => chip === "all" ? t.likes + t.comments + t.shares + t.saves : chip === "likes" ? t.likes : chip === "comments" ? t.comments : chip === "shares" ? t.shares : t.saves;
                const max = Math.max(1, ...types.map(val));
                const sum = types.reduce((s, t) => s + val(t), 0) || 1;
                return (
                  <ul className="in-bars">
                    {[...types].sort((a, b) => val(b) - val(a)).map((t) => (
                      <li key={t.type}>
                        <div className="in-row"><span>{typeLabel(t.type)}</span><b>{full(val(t))} <em>({(val(t) / sum * 100).toFixed(0)}%)</em></b></div>
                        <div className="in-track"><div className="in-fill" style={{ width: `${val(t) / max * 100}%`, background: accent }} /></div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- กราฟเส้น SVG ---------- */
type Pt = { day: string; v: number | null };
function LineChart({ cur, prev, color }: { cur: Pt[]; prev: Pt[]; color: string }) {
  const W = 720, H = 240, L = 44, R = 12, T = 12, B = 26;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const max = Math.max(1, ...cur.map((p) => p.v ?? 0), ...prev.map((p) => p.v ?? 0));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const x = (i: number, n: number) => L + (n <= 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const path = (s: Pt[]) => { let on = false; return s.map((p, i) => { if (p.v === null) { on = false; return ""; } const c = `${on ? "L" : "M"}${x(i, s.length).toFixed(1)},${y(p.v).toFixed(1)}`; on = true; return c; }).join(" "); };
  const hasPrev = prev.some((p) => p.v !== null);
  const lone = cur.map((p, i) => (p.v !== null && cur[i - 1]?.v == null && cur[i + 1]?.v == null ? i : -1)).filter((i) => i >= 0);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelIdx = cur.length <= 1 ? [0] : [0, 1, 2, 3, 4].map((k) => Math.round((k / 4) * (cur.length - 1))).filter((v, i, a) => a.indexOf(v) === i);
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r || !cur.length) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(cur.length - 1, Math.round(((px - L) / (W - L - R)) * (cur.length - 1)))));
  };
  const h = hover !== null ? cur[hover] : null;
  return (
    <div className="in-chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กราฟเส้นรายวัน" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#eceae2" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#888780">{fmt(t)}</text></g>)}
        {labelIdx.map((i) => <text key={i} x={x(i, cur.length)} y={H - 6} textAnchor={i === 0 ? "start" : i === cur.length - 1 ? "end" : "middle"} fontSize="11" fill="#888780">{shortDay(cur[i].day)}</text>)}
        {hasPrev && <path d={path(prev)} fill="none" stroke={color} strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="5 4" />}
        <path d={path(cur)} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        {lone.map((i) => <circle key={i} cx={x(i, cur.length)} cy={y(cur[i].v as number)} r="3.5" fill={color} />)}
        {hover !== null && h && <g><line x1={x(hover, cur.length)} x2={x(hover, cur.length)} y1={T} y2={H - B} stroke="#b4b2a9" />{h.v !== null && <circle cx={x(hover, cur.length)} cy={y(h.v)} r="4.5" fill="#fff" stroke={color} strokeWidth="2" />}</g>}
      </svg>
      {hover !== null && h && (
        <div className="in-tip" style={{ left: `${(x(hover, cur.length) / W) * 100}%` }}>
          <b>{h.v === null ? "ไม่มีข้อมูล" : full(h.v)}</b><span>{shortDay(h.day)}</span>
          {prev[hover]?.v != null && <span className="p">ช่วงก่อน {full(prev[hover].v as number)}</span>}
        </div>
      )}
    </div>
  );
}
function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/* ---------- แผงอัปโหลด ---------- */
function UploadPanel({ defaultChannel, onSaved, rows }: { defaultChannel: Channel; onSaved: () => void; rows: MetricRow[] }) {
  const [ch, setCh] = useState<Channel>(defaultChannel);
  const [mode, setMode] = useState<"csv" | "manual" | "delete">("csv");
  const [csv, setCsv] = useState<CsvResult | null>(null);
  const [fileNotes, setFileNotes] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [need, setNeed] = useState(false);
  const [pw, setPw] = useState("");
  const retry = useRef<(() => void) | null>(null);
  const today = bangkokToday();
  const [mDay, setMDay] = useState(today);
  const [mType, setMType] = useState("all");
  const [mVals, setMVals] = useState<Partial<Record<Field, string>>>({});
  const [dFrom, setDFrom] = useState(addDays(today, -29));
  const [dTo, setDTo] = useState(today);

  const call = async (url: string, init: RequestInit, again: () => void) => {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : { error: "เชื่อมต่อไม่ได้" };
    setBusy(false);
    if (res?.status === 401) { retry.current = again; setNeed(true); return null; }
    if (!res?.ok) { setErr(d.error ?? "ไม่สำเร็จ"); return null; }
    setNeed(false); return d as Record<string, unknown>;
  };
  const upload = async (list: ImportRow[]) => {
    const body = list.map((r) => ({ day: r.day, content_type: r.content_type, ...r.values }));
    // ส่งทีละ 1,000 แถว
    let saved = 0;
    for (let i = 0; i < body.length; i += 1000) {
      const d = await call("/api/marketing/insights", { method: "POST", body: JSON.stringify({ channel: ch, rows: body.slice(i, i + 1000) }) }, () => upload(list));
      if (!d) return;
      saved += Number(d.saved) || 0;
    }
    setMsg(`บันทึก ${saved.toLocaleString("th-TH")} แถวของ ${ch} แล้ว`);
    setCsv(null); setFileName(""); setMVals({});
    onSaved();
  };
  const onFile = async (files: FileList | null) => {
    setMsg(""); setErr(""); setCsv(null); setFileNotes([]);
    if (!files?.length) return;
    const merged = new Map<string, ImportRow>(), mapping: CsvResult["mapping"] = [], notes: string[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      if (f.size > 5 * 1024 * 1024) { notes.push(`${f.name}: ไฟล์ใหญ่เกิน 5 MB`); continue; }
      const r = rowsFromCsv(decodeText(await f.arrayBuffer()));
      if (r.error) { notes.push(`${f.name}: ${r.error}`); continue; }
      skipped += r.skipped;
      const used = r.mapping.filter((m) => m.col && m.col !== "day" && m.col !== "content_type");
      notes.push(`${f.name}: ${used.map((m) => FIELD_LABEL[m.col as Field]).join(", ")} (${r.rows.length} วัน)`);
      mapping.push(...r.mapping.filter((m) => m.col !== "day" || !mapping.some((x) => x.col === "day")));
      for (const row of r.rows) {
        const k = `${row.day}|${row.content_type}`, cur = merged.get(k);
        merged.set(k, cur ? { ...cur, values: { ...cur.values, ...row.values } } : row);
      }
    }
    setFileName(files.length > 1 ? `${files.length} ไฟล์` : files[0].name);
    setFileNotes(notes);
    const rows = [...merged.values()].sort((a, b) => a.day.localeCompare(b.day));
    setCsv(rows.length ? { rows, mapping, skipped } : { rows: [], mapping, skipped, error: "ไม่พบข้อมูลที่อ่านได้จากไฟล์ที่เลือก" });
  };
  const login = async () => {
    const r = await fetch("/api/roadmap/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null);
    if (r?.ok) { setPw(""); setNeed(false); retry.current?.(); } else setErr("รหัสผ่านไม่ถูกต้อง");
  };
  const saveManual = () => {
    if (!isDay(mDay)) { setErr("เลือกวันที่"); return; }
    const values: ImportRow["values"] = {};
    for (const f of FIELDS) { const v = (mVals[f] ?? "").replace(/,/g, "").trim(); if (v !== "" && Number.isFinite(Number(v))) values[f] = Math.max(0, Math.round(Number(v))); }
    if (!Object.keys(values).length) { setErr("กรอกตัวเลขอย่างน้อย 1 ช่อง"); return; }
    upload([{ day: mDay, content_type: mType, values }]);
  };
  const del = () => {
    if (!confirm(`ลบข้อมูล ${ch} ตั้งแต่ ${dFrom} ถึง ${dTo}?`)) return;
    const go = async () => {
      const d = await call(`/api/marketing/insights?channel=${encodeURIComponent(ch)}&from=${dFrom}&to=${dTo}`, { method: "DELETE" }, go);
      if (d) { setMsg("ลบข้อมูลแล้ว"); onSaved(); }
    };
    go();
  };
  const count = rows.filter((r) => r.channel === ch).length;
  const last = rows.filter((r) => r.channel === ch).reduce((m, r) => (r.day > m ? r.day : m), "");

  return (
    <section className="in-panel in-up">
      <div className="in-up-top">
        <div>
          <label className="in-lab" htmlFor="up-ch">ช่องทาง</label>
          <div className="in-seg" id="up-ch" role="group">{CHANNELS.map((c) => <button key={c} className={ch === c ? "on" : ""} style={ch === c ? { borderColor: ACCENT[c], color: ACCENT[c] } : undefined} aria-pressed={ch === c} onClick={() => setCh(c)}>{c}</button>)}</div>
        </div>
        <p className="in-note" style={{ margin: 0 }}>{count ? `มีข้อมูล ${count.toLocaleString("th-TH")} แถว ล่าสุด ${last}` : "ยังไม่มีข้อมูลของช่องนี้"}</p>
      </div>
      <div className="in-seg in-modes" role="tablist">
        {([["csv", "อัปโหลดไฟล์ CSV"], ["manual", "กรอกรายวัน"], ["delete", "ลบข้อมูลช่วงวันที่"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""} onClick={() => { setMode(k); setErr(""); setMsg(""); }}>{l}</button>)}
      </div>

      {mode === "csv" && (
        <div>
          <p className="in-note">ส่งออกจาก Insights / Analytics ของแต่ละช่องเป็น CSV เลือกได้หลายไฟล์พร้อมกัน (ไฟล์ของ Meta ที่แยกตามตัวชี้วัดก็ใช้ได้ ระบบรวมตามวันที่ให้) ต้องมีคอลัมน์วันที่ และตัวเลขอย่างน้อย 1 อย่าง (Views, Likes, Shares, Saves ฯลฯ) ถ้ามีคอลัมน์ประเภทคอนเทนต์ ระบบจะแยกกราฟตามประเภทให้ ไฟล์ภาษาไทยหรืออังกฤษใช้ได้ วันที่ ค.ศ./พ.ศ. ใช้ได้ ข้อมูลวันเดิมจะถูกอัปเดตทับ</p>
          <input type="file" multiple accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files)} aria-label="เลือกไฟล์ CSV" />
          {fileNotes.length > 0 && <ul className="in-files">{fileNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {csv?.error && <p role="alert" className="in-err">{csv.error}</p>}
          {csv && !csv.error && (
            <div className="in-prev">
              <p><b>{fileName}</b> อ่านได้ {csv.rows.length.toLocaleString("th-TH")} แถว ({csv.rows[0].day} – {csv.rows[csv.rows.length - 1].day}){csv.skipped > 0 && <> · ข้าม {csv.skipped} แถว</>}</p>
              <div className="in-map" hidden={csv.mapping.length > 12}>
                {csv.mapping.map((m, i) => <span key={i} className={m.col ? "ok" : "no"}>{m.header || "(ว่าง)"} → {m.col ? (m.col === "day" ? "วันที่" : m.col === "content_type" ? "ประเภทคอนเทนต์" : FIELD_LABEL[m.col]) : "ไม่ใช้"}</span>)}
              </div>
              <button className="in-btn on" disabled={busy} onClick={() => upload(csv.rows)}>{busy ? "กำลังบันทึก…" : `บันทึกข้อมูล ${ch}`}</button>
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div>
          <div className="in-form">
            <label>วันที่<input type="date" value={mDay} max={today} onChange={(e) => setMDay(e.target.value)} /></label>
            <label>ประเภท
              <select value={mType} onChange={(e) => setMType(e.target.value)}>
                <option value="all">ยอดรวมทุกประเภท</option><option value="reels">Reels / วิดีโอสั้น</option><option value="posts">โพสต์</option><option value="stories">สตอรี่</option><option value="live">ไลฟ์</option>
              </select>
            </label>
            {FIELDS.map((f) => <label key={f}>{FIELD_LABEL[f]}<input inputMode="numeric" value={mVals[f] ?? ""} onChange={(e) => setMVals({ ...mVals, [f]: e.target.value })} /></label>)}
          </div>
          <button className="in-btn on" disabled={busy} onClick={saveManual}>{busy ? "กำลังบันทึก…" : "บันทึกวันนี้"}</button>
        </div>
      )}

      {mode === "delete" && (
        <div>
          <p className="in-note">ลบข้อมูลของ {ch} เฉพาะช่วงวันที่ที่เลือก (ใช้เมื่ออัปโหลดผิดไฟล์)</p>
          <div className="in-form">
            <label>ตั้งแต่<input type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} /></label>
            <label>ถึง<input type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} /></label>
          </div>
          <button className="in-btn danger" disabled={busy} onClick={del}>ลบข้อมูลช่วงนี้</button>
        </div>
      )}

      {need && (
        <div className="in-login">
          <label className="in-lab" htmlFor="up-pw">ต้องใส่รหัสผ่านเดียวกับหน้า Roadmap</label>
          <div className="in-inline"><input id="up-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} /><button className="in-btn on" onClick={login}>เข้าสู่ระบบ</button></div>
        </div>
      )}
      {msg && <p className="in-ok" role="status">{msg}</p>}
      {err && <p role="alert" className="in-err">{err}</p>}
    </section>
  );
}

const CSS = `
.in{max-width:1040px;margin:0 auto;padding:18px 16px 48px;color:#1a1a18;font-family:inherit}
.in *{box-sizing:border-box}
.in-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.in-back{font-size:13px;color:#5f5e5a;text-decoration:none;padding:6px 0;flex:0 0 100%}
.in-title{flex:1 1 260px}.in-title h1{margin:0;font-size:24px;line-height:1.2}.in-title p{margin:4px 0 0;font-size:13px;color:#5f5e5a}
.in-btn{font:inherit;font-size:13px;padding:8px 14px;border-radius:8px;border:1px solid #d3d1c7;background:#fff;color:#1a1a18;cursor:pointer}
.in-btn.on{background:#C0200A;border-color:#C0200A;color:#fff}.in-btn.danger{background:#fff;border-color:#C0200A;color:#C0200A}
.in-btn:disabled{opacity:.6;cursor:default}
.in-btn:focus-visible,.in-seg button:focus-visible,.in-card:focus-visible,.in-chips button:focus-visible{outline:2px solid #185FA5;outline-offset:2px}
.in-bar{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;margin-bottom:8px}
.in-seg{display:flex;gap:4px;flex-wrap:wrap}
.in-seg button{font:inherit;font-size:13px;padding:7px 12px;border-radius:8px;border:1px solid #e5e3db;background:#fff;color:#5f5e5a;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.in-seg button.on{font-weight:600;background:#fff;border-width:1.5px;color:#1a1a18;border-color:#1a1a18}
.in-seg button i{width:6px;height:6px;border-radius:50%}
.in-custom{display:flex;gap:12px;flex-wrap:wrap;margin:6px 0;font-size:13px}.in-custom input,.in-form input,.in-form select,.in-inline input{font:inherit;font-size:14px;padding:7px 9px;border:1px solid #d3d1c7;border-radius:8px;background:#fff;max-width:100%}
.in-range{font-size:12.5px;color:#5f5e5a;margin:4px 0 14px}
.in-note{font-size:13px;color:#5f5e5a;margin:8px 0}.in-err{font-size:13px;color:#A32D2D;background:#FCEBEB;border:1px solid #F7C1C1;border-radius:8px;padding:8px 10px;margin:8px 0}
.in-ok{font-size:13px;color:#27500A;background:#EAF3DE;border:1px solid #C0DD97;border-radius:8px;padding:8px 10px;margin:8px 0}
.in-empty{background:#fff;border:1px dashed #d3d1c7;border-radius:12px;padding:28px 20px;text-align:center}.in-empty p{font-size:13px;color:#5f5e5a;max-width:460px;margin:6px auto 14px}
.in-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
.in-card{font:inherit;text-align:left;background:#fff;border:1px solid #e5e3db;border-radius:12px;padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:4px;min-width:0}
.in-card.on{border-width:2px;padding:11px 13px}
.in-lab{font-size:12.5px;color:#5f5e5a;display:block;margin-bottom:4px}.in-card .in-lab{margin:0}
.in-card b{font-size:24px;line-height:1.15;font-variant-numeric:tabular-nums}
.in-d{font-size:11.5px;color:#888780}.in-d.up{color:#27763a}.in-d.down{color:#A32D2D}
.in-panel{background:#fff;border:1px solid #e5e3db;border-radius:12px;padding:16px;margin-bottom:14px;min-width:0}
.in-panel h2{margin:0 0 12px;font-size:15px}
.in-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.in-two .in-panel{margin:0}
.in-chart{position:relative}.in-chart svg{width:100%;height:auto;display:block;touch-action:pan-y}
.in-tip{position:absolute;top:6px;transform:translateX(-50%);background:#1a1a18;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;pointer-events:none;display:flex;flex-direction:column;gap:1px;white-space:nowrap}
.in-tip b{font-size:14px}.in-tip .p{color:#b4b2a9}
.in-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#5f5e5a;margin-top:10px}.in-leg span{display:inline-flex;align-items:center;gap:6px}
.in-leg i{width:12px;height:3px;border-radius:2px;display:inline-block}.in-leg i.dash{background:none;border-top:2px dashed;height:0;opacity:.5}
.in-bars{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.in-row{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:5px}.in-row b{font-variant-numeric:tabular-nums}.in-row em{font-style:normal;color:#888780;font-weight:400}
.in-track{height:12px;background:#f1efe8;border-radius:6px;overflow:hidden}.in-fill{height:100%;border-radius:6px;overflow:hidden}.in-fill>div{height:100%}
.in-bars small{display:block;font-size:11.5px;color:#888780;margin-top:4px}
.in-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.in-chips button{font:inherit;font-size:12.5px;padding:5px 12px;border-radius:99px;border:1px solid #d3d1c7;background:#fff;color:#5f5e5a;cursor:pointer}.in-chips button.on{color:#fff}
.in-up{background:#FAF9F5}.in-up-top{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;margin-bottom:12px}
.in-modes{margin-bottom:12px}
.in-files{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:#5f5e5a}.in-prev{margin-top:12px;border-top:1px solid #e5e3db;padding-top:12px;font-size:13px}
.in-map{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px}.in-map span{font-size:12px;border-radius:6px;padding:3px 8px;border:1px solid}
.in-map .ok{background:#EAF3DE;border-color:#C0DD97;color:#27500A}.in-map .no{background:#f1efe8;border-color:#e5e3db;color:#888780}
.in-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}.in-form label{font-size:12.5px;color:#5f5e5a;display:flex;flex-direction:column;gap:4px}
.in-login{margin-top:12px}.in-inline{display:flex;gap:6px;flex-wrap:wrap}
@media (max-width:860px){.in-cards{grid-template-columns:repeat(2,1fr)}.in-cards .in-card:first-child{grid-column:1/-1}.in-two{grid-template-columns:1fr}}
@media (prefers-reduced-motion:no-preference){.in-fill{transition:width .3s ease}}
`;
