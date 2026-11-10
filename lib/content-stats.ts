import { notion } from "@/lib/notion";
import { sb } from "@/lib/roadmap-db";
import { PILLARS, PLAN_START, REEL_CHANNELS, WEEK_THEMES } from "@/lib/content-plan";

/* รวมผลคอนเทนต์: ดึงคลิปจาก Notion + ผลรายช่องและคำตอบลูกค้าจาก Supabase แล้วคำนวณสรุปตามสูตรในไฟล์ Fryday_Content_System.xlsx */

export const METRICS = ["views", "likes", "comments", "shares", "saves", "profile_visits", "new_followers"] as const;
export type Metric = (typeof METRICS)[number];
export type ResultRow = { campaign_id: string; channel: string; captured_on: string | null } & Record<Metric, number | null>;
export const SURVEY_FIELDS = ["tiktok", "instagram", "facebook", "youtube", "friend", "passby", "other"] as const;
export type SurveyField = (typeof SURVEY_FIELDS)[number];
export type SurveyRow = { week_start: string } & Record<SurveyField, number>;

export interface Clip { id: string; title: string; pillar: string; status: string; postDate: string | null; week: number; results: Record<string, Partial<Record<Metric, number | null>> & { captured_on?: string | null }> }

const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
const DAY = 86400000;

export function weekOf(date: string | null): number {
  if (!date) return 0;
  const d = Math.floor((Date.parse(date.slice(0, 10) + "T00:00:00Z") - Date.parse(PLAN_START + "T00:00:00Z")) / DAY / 7) + 1;
  return d >= 1 && d <= 4 ? d : 0;
}
export const weekStart = (w: number) => new Date(Date.parse(PLAN_START + "T00:00:00Z") + (w - 1) * 7 * DAY).toISOString().slice(0, 10);

export async function listClips(): Promise<Omit<Clip, "results">[]> {
  const out: Omit<Clip, "results">[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({ database_id: process.env.NOTION_MARKETING_DB_ID!, start_cursor: cursor, page_size: 100 });
    for (const p of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (p as any).properties;
      const pillar = props["ประเภท Content"]?.select?.name ?? "";
      if (!(PILLARS as readonly string[]).includes(pillar)) continue; // นับเฉพาะคลิปที่ติดเสาหลัก
      const postDate: string | null = props["วันที่โพสต์"]?.date?.start ?? null;
      out.push({
        id: p.id,
        title: (props["ชื่อแคมเปญ/โพสต์"]?.title ?? []).map((t: { plain_text: string }) => t.plain_text).join(""),
        pillar, status: props["สถานะ"]?.select?.name ?? "", postDate, week: weekOf(postDate),
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.postDate ?? "").localeCompare(b.postDate ?? ""));
}

export async function loadAll() {
  const [clips, rows, survey] = await Promise.all([
    listClips(),
    sb<ResultRow[]>("content_results?select=*&limit=1000"),
    sb<SurveyRow[]>("content_survey?select=*&order=week_start"),
  ]);
  const byClip = new Map<string, Clip["results"]>();
  for (const r of rows ?? []) {
    const m = byClip.get(r.campaign_id) ?? {};
    m[r.channel] = { ...Object.fromEntries(METRICS.map((k) => [k, r[k]])), captured_on: r.captured_on };
    byClip.set(r.campaign_id, m);
  }
  return { clips: clips.map((c) => ({ ...c, results: byClip.get(c.id) ?? {} })), survey: survey ?? [] };
}

type Agg = { views: number; shares: number; saves: number; profile: number; followers: number };
const zero = (): Agg => ({ views: 0, shares: 0, saves: 0, profile: 0, followers: 0 });
function add(a: Agg, r: Clip["results"][string]) { a.views += n(r.views); a.shares += n(r.shares); a.saves += n(r.saves); a.profile += n(r.profile_visits); a.followers += n(r.new_followers); }
const pct = (a: number, b: number) => (b ? a / b : null);

export function summarize(clips: Clip[], survey: SurveyRow[]) {
  const weekly = [1, 2, 3, 4].map((w) => {
    const a = zero();
    for (const c of clips) if (c.week === w) for (const r of Object.values(c.results)) add(a, r);
    const s = survey.find((x) => x.week_start === weekStart(w));
    const asked = s ? SURVEY_FIELDS.reduce((t, k) => t + n(s[k]), 0) : 0;
    const fromClip = s ? n(s.tiktok) + n(s.instagram) + n(s.facebook) + n(s.youtube) : 0;
    return { week: w, theme: WEEK_THEMES[w - 1], ...a, shareSave: a.shares + a.saves, shareSavePct: pct(a.shares + a.saves, a.views), asked, fromClip, fromClipPct: pct(fromClip, asked) };
  });
  const pillars = PILLARS.map((p) => {
    const a = zero(); let posted = 0;
    for (const c of clips) if (c.pillar === p) { if (c.status === "โพสต์แล้ว" || c.status === "วัดผล") posted++; for (const r of Object.values(c.results)) add(a, r); }
    return { pillar: p, ...a, posted, avgViews: posted ? a.views / posted : null, shareSave: a.shares + a.saves, shareSavePct: pct(a.shares + a.saves, a.views) };
  });
  const channels = REEL_CHANNELS.map((ch) => {
    const a = zero();
    for (const c of clips) if (c.results[ch]) add(a, c.results[ch]);
    return { channel: ch, ...a, shareSave: a.shares + a.saves, shareSavePct: pct(a.shares + a.saves, a.views) };
  });
  let top: { title: string; channel: string; views: number } | null = null;
  for (const c of clips) for (const [ch, r] of Object.entries(c.results)) if (n(r.views) > (top?.views ?? 0)) top = { title: c.title, channel: ch, views: n(r.views) };
  const bestPillar = pillars.filter((p) => p.avgViews !== null).sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0))[0]?.pillar ?? null;
  return { weekly, pillars, channels, top, bestPillar };
}
