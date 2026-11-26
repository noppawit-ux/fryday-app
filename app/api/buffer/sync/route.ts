import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/roadmap-db";
import { isAuthed } from "@/lib/roadmap-auth";
import { BufferError, fetchSentPosts, listChannels, organizationId } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ดึงสถิติโพสต์จาก Buffer ลง Supabase (buffer_post_stats)
   GET  = Vercel Cron (ต้องมี Authorization: Bearer CRON_SECRET) หรือผู้ที่ล็อกอินแล้ว
   POST = ปุ่ม "ซิงค์ตอนนี้" (ต้องล็อกอิน) | GET ?status=1 = ดูซิงค์ล่าสุด (ต้องล็อกอิน) */

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); // วันที่ตามเวลาไทย

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return isAuthed();
}

async function log(ok: boolean, posts: number, detail: string) {
  try {
    await sb("buffer_sync_log", { method: "POST", body: JSON.stringify([{ ok, posts, detail: detail.slice(0, 500) }]) });
  } catch { /* ตารางอาจยังไม่ได้สร้าง */ }
}

async function run() {
  const [orgId, channels] = await Promise.all([organizationId(), listChannels()]);
  if (!channels.length) throw new BufferError("ไม่พบช่อง Facebook/Instagram/TikTok ใน Buffer");
  const captured_on = today();
  let total = 0;
  const perChannel: Record<string, number> = {};
  for (const ch of channels) {
    const posts = await fetchSentPosts(orgId, ch);
    perChannel[`${ch.service}:${ch.name}`] = posts.length;
    if (!posts.length) continue;
    const rows = posts.map((p) => ({ ...p, captured_on, fetched_at: new Date().toISOString() }));
    await sb("buffer_post_stats?on_conflict=post_id,captured_on", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    total += posts.length;
  }
  return { posts: total, channels: perChannel, captured_on };
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "ต้องล็อกอินก่อน", code: "auth" }, { status: 401 });
  try {
    const r = await run();
    await log(true, r.posts, JSON.stringify(r.channels));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ซิงค์ไม่สำเร็จ";
    await log(false, 0, msg);
    const status = e instanceof BufferError ? e.status : 502;
    return NextResponse.json({ error: "ซิงค์จาก Buffer ไม่สำเร็จ", detail: msg }, { status: status === 429 ? 429 : status >= 500 ? status : 502 });
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("status")) {
    if (!(await isAuthed())) return NextResponse.json({ error: "ต้องล็อกอินก่อน", code: "auth" }, { status: 401 });
    try {
      const last = await sb<unknown[]>("buffer_sync_log?select=ran_at,ok,posts,detail&order=ran_at.desc&limit=5");
      const count = await sb<{ post_id: string }[]>("buffer_post_stats?select=post_id&limit=1");
      return NextResponse.json({ last, hasData: (count ?? []).length > 0, configured: !!process.env.BUFFER_API_KEY });
    } catch (e) {
      return NextResponse.json({ error: "อ่านสถานะไม่ได้", detail: e instanceof Error ? e.message.slice(0, 200) : "" }, { status: 502 });
    }
  }
  return handle(req);
}
export const POST = handle;
