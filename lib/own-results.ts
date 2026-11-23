import { summarize, type Clip, type SurveyRow } from "@/lib/content-stats";

const nf = (v: number) => Math.round(v).toLocaleString("en-US");

/* สรุปผลคลิปเก่าของร้านเป็นข้อความสั้นให้ AI ใช้เป็นแนวทาง คืน null ถ้ายังไม่มีผลวัด */
export function buildOwnResults(clips: Clip[], survey: SurveyRow[]): { text: string; basis: { clips: number; bestPillar: string | null } } | null {
  const withViews = clips
    .map((c) => ({ c, views: Object.values(c.results).reduce((t, r) => t + (typeof r.views === "number" ? r.views : 0), 0) }))
    .filter((x) => x.views > 0);
  if (withViews.length === 0) return null;
  const sum = summarize(clips, survey);
  const lines: string[] = [`มีผลวัดแล้ว ${withViews.length} คลิป (ตัวอย่างน้อย อย่าสรุปเกินข้อมูล)`];
  for (const p of sum.pillars) if (p.posted > 0) lines.push(`เสาหลัก “${p.pillar}”: โพสต์แล้ว ${p.posted} คลิป views เฉลี่ย ${p.avgViews === null ? "-" : nf(p.avgViews)}${p.shareSavePct === null ? "" : ` แชร์+เซฟ ${(p.shareSavePct * 100).toFixed(1)}% ของ views`}`);
  for (const ch of sum.channels) if (ch.views > 0) lines.push(`ช่อง ${ch.channel}: views รวม ${nf(ch.views)}${ch.followers ? ` ผู้ติดตามใหม่ ${nf(ch.followers)}` : ""}`);
  const top = [...withViews].sort((a, b) => b.views - a.views).slice(0, 3);
  lines.push("คลิป views สูงสุด:", ...top.map((x) => `- “${x.c.title}” (${x.c.pillar}) ${nf(x.views)} views`));
  return { text: lines.join("\n"), basis: { clips: withViews.length, bestPillar: sum.bestPillar } };
}
