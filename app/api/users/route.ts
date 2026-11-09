import { NextResponse } from "next/server";
import { notion } from "@/lib/notion";

export const dynamic = "force-dynamic";

// รายชื่อคนใน Notion workspace สำหรับเลือก "ผู้รับผิดชอบ"
// ต้องเปิดสิทธิ์ "Read user information" ให้ Notion integration ก่อน
export async function GET() {
  try {
    const res = await notion.users.list({ page_size: 100 });
    const people = res.results
      .filter((u) => u.type === "person")
      .map((u) => ({ id: u.id, name: u.name ?? "(ไม่มีชื่อ)", avatar: u.avatar_url ?? null }));
    return NextResponse.json({ people });
  } catch (err) {
    console.error("[GET /api/users]", err);
    const detail = err instanceof Error ? err.message.slice(0, 160) : undefined;
    return NextResponse.json({ error: "ดึงรายชื่อผู้รับผิดชอบไม่ได้", detail }, { status: 502 });
  }
}
