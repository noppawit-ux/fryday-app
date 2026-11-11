/* สถิติเพจรายช่องทาง: ค่าคงที่ + แปลงไฟล์ CSV + รวมตัวเลข (ใช้ได้ทั้งเบราว์เซอร์และเซิร์ฟเวอร์) */

export const CHANNELS = ["TikTok", "Instagram", "Facebook", "YouTube"] as const;
export type Channel = (typeof CHANNELS)[number];
export const FIELDS = ["views", "viewers", "follower_views", "likes", "comments", "shares", "saves", "profile_visits", "new_followers", "interactions"] as const;
export type Field = (typeof FIELDS)[number];
export const FIELD_LABEL: Record<Field, string> = {
  views: "การดู", viewers: "ผู้ชม", follower_views: "การดูจากผู้ติดตาม", likes: "ไลก์", comments: "ความคิดเห็น", shares: "แชร์", saves: "บันทึก",
  profile_visits: "เข้าโปรไฟล์", new_followers: "ผู้ติดตามใหม่", interactions: "การโต้ตอบรวม",
};
export const INTERACTION_FIELDS: Field[] = ["likes", "comments", "shares", "saves"];

export interface MetricRow { channel: string; day: string; content_type: string; [k: string]: string | number | null }
export interface ImportRow { day: string; content_type: string; values: Partial<Record<Field, number | null>> }

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const bangkokToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/* ---------- CSV ---------- */
/* ไฟล์ส่งออกของ Meta เป็น UTF-16 (มี BOM) ส่วนไฟล์อื่นส่วนใหญ่เป็น UTF-8 */
export function decodeText(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const first = t.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export type Col = Field | "day" | "content_type" | null;
export function mapHeader(h: string): Col {
  const s = h.trim().toLowerCase();
  if (!s) return null;
  if (/^(date|day|time|period|วันที่|วัน|เวลา)/.test(s)) return "day";
  if (/(content.?type|media.?type|post.?type|format|ประเภท)/.test(s)) return "content_type";
  if (/(follower.*view|view.*follower|from followers|ผู้ติดตาม.*(ดู|วิว)|(ดู|วิว).*ผู้ติดตาม)/.test(s)) return "follower_views";
  if (/(new.?follow|follows|net.?follow|followers? gained|ผู้ติดตามใหม่|ติดตามเพิ่ม|ผู้ติดตามเพิ่ม|การติดตาม)/.test(s)) return "new_followers";
  if (/(link.?(click|tap)|คลิกลิงก์)/.test(s)) return null;
  if (/(interaction|engagement|การโต้ตอบ)/.test(s)) return "interactions";
  if (/(viewers|unique|accounts reached|reach|ผู้ชม|การเข้าถึง|เข้าถึง)/.test(s)) return "viewers";
  if (/(view|play|impression|วิว|การดู|ยอดดู|จำนวนการดู)/.test(s)) return "views";
  if (/(like|ไลก์|ถูกใจ)/.test(s)) return "likes";
  if (/(comment|คอมเมนต์|ความคิดเห็น)/.test(s)) return "comments";
  if (/(share|repost|แชร์)/.test(s)) return "shares";
  if (/(save|bookmark|บันทึก)/.test(s)) return "saves";
  if (/(profile|โปรไฟล์|visits?|การเข้าชม)/.test(s)) return "profile_visits";
  return null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const fix = (y: number) => (y > 2400 ? y - 543 : y < 100 ? 2000 + y : y);
const ymd = (y: number, m: number, d: number) => {
  const s = `${fix(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isDay(s) && new Date(s).getUTCDate() === d ? s : null;
};
export function parseDay(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) return ymd(+m[3], +m[2], +m[1]); // วัน/เดือน/ปี
  m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/.exec(s);
  if (m && MONTHS[m[1].toLowerCase()]) return ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.? (\d{4})/.exec(s);
  if (m && MONTHS[m[2].toLowerCase()]) return ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}
export function parseNum(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "").replace(/\s/g, "");
  if (!s || s === "-" || s === "–") return null;
  const m = /^(-?\d+(?:\.\d+)?)([kKmM])?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? (m[2].toLowerCase() === "k" ? 1e3 : 1e6) : 1);
  return Math.max(0, Math.min(1e9, Math.round(n)));
}
export function normType(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s === "all" || s === "total" || s === "รวม" || s === "ทั้งหมด") return "all";
  if (/(reel|short|video|วิดีโอ|คลิป)/.test(s)) return "reels";
  if (/(stor|สตอรี่)/.test(s)) return "stories";
  if (/(post|photo|image|carousel|โพสต์|รูป)/.test(s)) return "posts";
  if (/(live|ไลฟ์)/.test(s)) return "live";
  return s.replace(/[^a-z0-9ก-๙_ -]/g, "").slice(0, 30) || "all";
}
export const TYPE_LABEL: Record<string, string> = { reels: "Reels / วิดีโอสั้น", posts: "โพสต์", stories: "สตอรี่", live: "ไลฟ์" };

export interface CsvResult { rows: ImportRow[]; mapping: { header: string; col: Col }[]; skipped: number; error?: string }
export function rowsFromCsv(text: string): CsvResult {
  let table = parseCsv(text.replace(/^\uFEFF/, "").replace(/^sep=.\r?\n/i, ""));
  // รูปแบบส่งออกของ Meta: แถวแรกเป็นชื่อรายงาน (เช่น "ยอดดู") ตามด้วยหัวตาราง "วันที่","Primary"
  let title = "";
  if (table.length > 2 && table[0].filter((c) => c.trim()).length === 1 && mapHeader(table[1][0] ?? "") === "day") { title = table[0][0].trim(); table = table.slice(1); }
  if (table.length < 2) return { rows: [], mapping: [], skipped: 0, error: "ไฟล์ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว" };
  const head = table[0];
  const metricTitle = title ? mapHeader(title) : null;
  const mapping = head.map((h, i) => ({ header: h.trim(), col: mapHeader(h) ?? (i > 0 && /^(primary|value|ค่า|total)$/i.test(h.trim()) ? metricTitle : null) }));
  if (title) mapping.forEach((m) => { if (m.col === metricTitle && m.header !== head[0].trim()) m.header = `${title} (${m.header})`; });
  const used = new Set<string>();
  // ถ้าหัวตารางซ้ำ ใช้คอลัมน์แรกที่เจอ
  const cols = mapping.map((m) => { if (!m.col || used.has(m.col)) return null; used.add(m.col); return m.col; });
  const di = cols.indexOf("day");
  if (di < 0) return { rows: [], mapping, skipped: 0, error: "ไม่พบคอลัมน์วันที่ (Date / วันที่)" };
  if (!cols.some((c) => c && c !== "day" && c !== "content_type")) return { rows: [], mapping, skipped: 0, error: "ไม่พบคอลัมน์ตัวเลขที่รู้จัก (เช่น Views, Likes, Shares)" };
  const ti = cols.indexOf("content_type");
  const out = new Map<string, ImportRow>();
  let skipped = 0;
  for (const r of table.slice(1)) {
    const day = parseDay(r[di] ?? "");
    if (!day) { skipped++; continue; }
    const content_type = ti >= 0 ? normType(r[ti] ?? "") : "all";
    const values: ImportRow["values"] = {};
    cols.forEach((c, i) => { if (c && c !== "day" && c !== "content_type") { const n = parseNum(r[i] ?? ""); if (n !== null) values[c] = n; } });
    if (!Object.keys(values).length) { skipped++; continue; }
    out.set(`${day}|${content_type}`, { day, content_type, values });
  }
  const rows = [...out.values()].sort((a, b) => a.day.localeCompare(b.day));
  return { rows, mapping, skipped, error: rows.length ? undefined : "ไม่พบแถวข้อมูลที่อ่านได้ (ตรวจรูปแบบวันที่และตัวเลข)" };
}

/* ---------- รวมตัวเลข ---------- */
const n = (v: unknown) => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);
export type Totals = Record<Field, number>;
const zero = (): Totals => Object.fromEntries(FIELDS.map((f) => [f, 0])) as Totals;

/* ยอดรวมรายวันต่อช่อง: ใช้แถว 'all' ถ้ามี ไม่งั้นรวมจากแถวแยกประเภท */
export function dailyTotals(rows: MetricRow[], channel: string | "all"): Map<string, Totals> {
  const groups = new Map<string, { all?: MetricRow; typed: MetricRow[] }>();
  for (const r of rows) {
    if (channel !== "all" && r.channel !== channel) continue;
    const k = `${r.channel}|${r.day}`;
    const g = groups.get(k) ?? { typed: [] };
    if (r.content_type === "all") g.all = r; else g.typed.push(r);
    groups.set(k, g);
  }
  const days = new Map<string, Totals>();
  for (const [k, g] of groups) {
    const day = k.split("|")[1];
    const t = days.get(day) ?? zero();
    for (const f of FIELDS) t[f] += g.all ? n(g.all[f]) : g.typed.reduce((s, r) => s + n(r[f]), 0);
    days.set(day, t);
  }
  /* การโต้ตอบรวม: ใช้ค่ารวมที่อัปโหลดมา หรือผลรวมไลก์+คอมเมนต์+แชร์+บันทึก แล้วแต่อันไหนมากกว่า */
  for (const t of days.values()) t.interactions = Math.max(t.interactions, INTERACTION_FIELDS.reduce((s, f) => s + t[f], 0));
  return days;
}

export function sumRange(days: Map<string, Totals>, from: string, to: string): Totals & { has: boolean } {
  const t = zero(); let has = false;
  for (const [d, v] of days) if (d >= from && d <= to) { has = true; for (const f of FIELDS) t[f] += v[f]; }
  return { ...t, has };
}

/* วันที่ไม่มีข้อมูลเป็น null (กราฟจะขาดช่วง ไม่ตกเป็น 0) */
export function series(days: Map<string, Totals>, from: string, to: string, key: Field): { day: string; v: number | null }[] {
  const out: { day: string; v: number | null }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) { const t = days.get(d); out.push({ day: d, v: t ? t[key] : null }); }
  return out;
}

export interface TypeStat { type: string; views: number; followerViews: number; likes: number; comments: number; shares: number; saves: number }
export function byType(rows: MetricRow[], channel: string | "all", from: string, to: string): TypeStat[] {
  const map = new Map<string, TypeStat>();
  for (const r of rows) {
    if ((channel !== "all" && r.channel !== channel) || r.content_type === "all" || r.day < from || r.day > to) continue;
    const s = map.get(r.content_type) ?? { type: r.content_type, views: 0, followerViews: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    s.views += n(r.views); s.followerViews += n(r.follower_views); s.likes += n(r.likes); s.comments += n(r.comments); s.shares += n(r.shares); s.saves += n(r.saves);
    map.set(r.content_type, s);
  }
  return [...map.values()].sort((a, b) => b.views - a.views);
}

export function delta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return (cur - prev) / prev;
}
