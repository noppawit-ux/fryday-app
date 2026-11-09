import { NextRequest, NextResponse } from "next/server";
import { notion } from "@/lib/notion";
import { readNotes, replaceNotes } from "@/lib/notion-notes";

// ---- GET /api/marketing/:id  → โน้ต/สคริปต์ของแคมเปญ ----
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ notes: await readNotes(id) }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/marketing/:id]", err);
    return NextResponse.json({ error: "อ่านสคริปต์ไม่สำเร็จ" }, { status: 500 });
  }
}

// ---- PATCH /api/marketing/:id  { status?, postDate? (null = ล้างวัน), title?, notes? } ----
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status, postDate, title, notes } = await req.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};
    if (status !== undefined)   properties["สถานะ"] = { select: { name: String(status) } };
    if (postDate !== undefined) properties["วันที่โพสต์"] = postDate ? { date: { start: String(postDate) } } : { date: null };
    if (title !== undefined)    properties["ชื่อแคมเปญ/โพสต์"] = { title: [{ text: { content: String(title).slice(0, 200) } }] };

    if (Object.keys(properties).length === 0 && notes === undefined) {
      return NextResponse.json({ error: "ไม่มีข้อมูลให้อัปเดต" }, { status: 400 });
    }
    if (Object.keys(properties).length) await notion.pages.update({ page_id: id, properties });
    if (notes !== undefined) await replaceNotes(id, String(notes));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/marketing/:id]", err);
    return NextResponse.json({ error: "อัปเดตไม่สำเร็จ", detail: err instanceof Error ? err.message.slice(0, 200) : "" }, { status: 500 });
  }
}
