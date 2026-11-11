import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/roadmap-db";
import { isAuthed } from "@/lib/roadmap-auth";
import { CHANNELS, FIELDS, addDays, bangkokToday, isDay } from "@/lib/page-insights";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* สถิติเพจรายวันต่อช่องทาง
   GET (เปิด) → แถวย้อนหลัง ~400 วัน | POST (ต้องล็อกอิน) {channel, rows:[{day, content_type?, views?, ...}]} อัปเสิร์ต
   DELETE (ต้องล็อกอิน) ?channel=&from=&to= ลบช่วงวันที่ */

const detail = (e: unknown) => (e instanceof Error ? e.message.slice(0, 200) : "");
const okChannel = (c: unknown): c is string => typeof c === "string" && (CHANNELS as readonly string[]).includes(c);

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(1500, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 400));
    const since = addDays(bangkokToday(), -days);
    // Supabase ตัดผลลัพธ์ที่ 1,000 แถวต่อคำขอ จึงดึงเป็นหน้าๆ
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < 30000; offset += 1000) {
      const page = (await sb<Record<string, unknown>[]>(`page_metrics?day=gte.${since}&select=*&order=day.asc,channel.asc,content_type.asc&limit=1000&offset=${offset}`)) ?? [];
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[GET /api/marketing/insights]", err);
    return NextResponse.json({ error: "ดึงสถิติเพจไม่สำเร็จ", detail: detail(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const b = await req.json();
    if (!okChannel(b.channel)) return NextResponse.json({ error: "เลือกช่องทางไม่ถูกต้อง" }, { status: 400 });
    if (!Array.isArray(b.rows) || !b.rows.length) return NextResponse.json({ error: "ไม่มีข้อมูลให้บันทึก" }, { status: 400 });
    if (b.rows.length > 2000) return NextResponse.json({ error: "ข้อมูลเกิน 2,000 แถวต่อครั้ง" }, { status: 400 });
    const now = new Date().toISOString();
    // รวมแถวที่คีย์ซ้ำ และจัดกลุ่มตามชุดคอลัมน์ เพราะ bulk upsert ต้องมีคีย์เท่ากันทุกแถว
    const groups = new Map<string, Record<string, unknown>[]>();
    const seen = new Set<string>();
    for (const r of b.rows) {
      if (!isDay(r?.day)) continue;
      const type = String(r.content_type ?? "all").slice(0, 30) || "all";
      const key = `${r.day}|${type}`;
      if (seen.has(key)) continue; seen.add(key);
      const row: Record<string, unknown> = { channel: b.channel, day: r.day, content_type: type, updated_at: now };
      for (const f of FIELDS) {
        const v = r[f];
        if (v === null || v === undefined || v === "") continue;
        const num = Math.round(Number(v));
        if (Number.isFinite(num)) row[f] = Math.max(0, Math.min(1e9, num));
      }
      if (Object.keys(row).length <= 4) continue;
      const sig = Object.keys(row).sort().join(",");
      groups.set(sig, [...(groups.get(sig) ?? []), row]);
    }
    let saved = 0;
    for (const list of groups.values()) {
      await sb("page_metrics?on_conflict=channel,day,content_type", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(list) });
      saved += list.length;
    }
    if (!saved) return NextResponse.json({ error: "ไม่พบแถวที่บันทึกได้ (ตรวจวันที่และตัวเลข)" }, { status: 400 });
    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    console.error("[POST /api/marketing/insights]", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ", detail: detail(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const p = req.nextUrl.searchParams;
    const channel = p.get("channel"), from = p.get("from"), to = p.get("to");
    if (!okChannel(channel) || !isDay(from) || !isDay(to) || from > to) return NextResponse.json({ error: "ระบุช่องทางและช่วงวันที่ให้ครบ" }, { status: 400 });
    await sb(`page_metrics?channel=eq.${encodeURIComponent(channel)}&day=gte.${from}&day=lte.${to}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/marketing/insights]", err);
    return NextResponse.json({ error: "ลบไม่สำเร็จ", detail: detail(err) }, { status: 500 });
  }
}
