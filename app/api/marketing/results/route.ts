import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/roadmap-db";
import { loadAll, summarize, METRICS, SURVEY_FIELDS, weekOf, weekStart } from "@/lib/content-stats";
import { REEL_CHANNELS } from "@/lib/content-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* ผลรายคลิป×ช่อง และตัวนับ "ลูกค้ารู้จักจากไหน"
   GET → คลิป + ผล + สรุปรายสัปดาห์/เสาหลัก/ช่อง | PUT {campaignId, channel, values} | POST {week, field, delta} (ปุ่มนับหน้าร้าน) */

const int = (v: unknown) => (v === null || v === "" || v === undefined ? null : Math.max(0, Math.min(1e9, Math.round(Number(v)))));
const detail = (e: unknown) => (e instanceof Error ? e.message.slice(0, 200) : "");

export async function GET() {
  try {
    const { clips, survey } = await loadAll();
    return NextResponse.json({ clips, survey, summary: summarize(clips, survey) });
  } catch (err) {
    console.error("[GET /api/marketing/results]", err);
    return NextResponse.json({ error: "ดึงผลไม่สำเร็จ", detail: detail(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const b = await req.json();
    const channel = String(b.channel ?? "");
    if (!b.campaignId || !(REEL_CHANNELS as readonly string[]).includes(channel)) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const row: Record<string, unknown> = { campaign_id: String(b.campaignId), channel, updated_at: new Date().toISOString() };
    for (const k of METRICS) if (k in (b.values ?? {})) row[k] = int(b.values[k]);
    if (typeof b.capturedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.capturedOn)) row.captured_on = b.capturedOn;
    await sb("content_results?on_conflict=campaign_id,channel", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/marketing/results]", err);
    return NextResponse.json({ error: "บันทึกผลไม่สำเร็จ", detail: detail(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const field = String(b.field ?? "");
    const delta = Math.max(-50, Math.min(50, Math.round(Number(b.delta) || 0)));
    let w = Number(b.week);
    if (!(w >= 1 && w <= 4)) w = weekOf(typeof b.date === "string" ? b.date : null);
    if (!(SURVEY_FIELDS as readonly string[]).includes(field) || !(w >= 1 && w <= 4) || !delta) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    const ws = weekStart(w);
    const cur = (await sb<Record<string, number>[]>(`content_survey?week_start=eq.${ws}&select=*`))?.[0] ?? {};
    const row: Record<string, unknown> = { week_start: ws, updated_at: new Date().toISOString() };
    for (const k of SURVEY_FIELDS) row[k] = Number(cur[k] ?? 0);
    row[field] = Math.max(0, Number(row[field]) + delta);
    await sb("content_survey?on_conflict=week_start", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    return NextResponse.json({ ok: true, week: w, field, value: row[field] });
  } catch (err) {
    console.error("[POST /api/marketing/results]", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ", detail: detail(err) }, { status: 500 });
  }
}
