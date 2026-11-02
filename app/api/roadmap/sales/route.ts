import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/roadmap-auth";
import { sb } from "@/lib/roadmap-db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    // ฟังก์ชันนี้อ่านอย่างเดียว และเรียกได้เฉพาะ service role (ดู supabase/roadmap.sql)
    const snapshot = await sb<Record<string, unknown>>("rpc/roadmap_snapshot", {
      method: "POST",
      body: "{}",
    });
    return NextResponse.json({ snapshot, fetchedAt: Date.now() });
  } catch (err) {
    console.error("[GET /api/roadmap/sales]", err);
    return NextResponse.json({ error: "ดึงตัวเลขยอดขายไม่สำเร็จ" }, { status: 502 });
  }
}
