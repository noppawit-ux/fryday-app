import { NextRequest, NextResponse } from "next/server";
import { notion, mapPageToTask } from "@/lib/notion";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, assigneeId, status, done, priority, category, deadline, note } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "กรุณาระบุชื่องาน" }, { status: 400 });
      }
      properties["ชื่องาน"] = { title: [{ text: { content: name.trim() } }] };
    }
    if (assigneeId !== undefined) properties["ผู้รับผิดชอบ"] = { people: assigneeId ? [{ id: assigneeId }] : [] };
    if (status !== undefined)   properties["สถานะ"]       = { select:    { name: status } };
    if (done !== undefined)     properties["เสร็จแล้ว?"]  = { checkbox:  done };
    if (priority !== undefined) properties["ความสำคัญ"]   = { select:    { name: priority } };
    if (category !== undefined) properties["หมวดหมู่"]    = { select:    { name: category } };
    if (deadline !== undefined) properties["Deadline"]     = deadline ? { date: { start: deadline } } : { date: null };
    if (note !== undefined)     properties["หมายเหตุ"]     = { rich_text: note ? [{ text: { content: note } }] : [] };

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลให้อัปเดต" }, { status: 400 });
    }

    const page = await notion.pages.update({ page_id: id, properties });
    const updatedTask = mapPageToTask(page);
    return NextResponse.json({ task: updatedTask }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/tasks/:id]", err);
    const detail = err instanceof Error ? err.message.slice(0, 160) : undefined;
    return NextResponse.json({ error: "อัปเดตไม่สำเร็จ", detail }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await notion.pages.update({ page_id: id, archived: true });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/tasks/:id]", err);
    return NextResponse.json({ error: "ลบงานไม่สำเร็จ" }, { status: 500 });
  }
}