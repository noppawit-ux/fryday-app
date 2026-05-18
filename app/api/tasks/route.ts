import { NextRequest, NextResponse } from "next/server";
import { notion, TASKS_DB_ID, mapPageToTask } from "@/lib/notion";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status    = searchParams.get("status");
    const assignee  = searchParams.get("assignee");
    const priority  = searchParams.get("priority");
    const doneParam = searchParams.get("done");
    const search    = searchParams.get("search");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [];

    if (status)   filters.push({ property: "สถานะ",          select:   { equals:   status   } });
    if (assignee) filters.push({ property: "ผู้รับผิดชอบ",   people:   { contains: assignee } });
    if (priority) filters.push({ property: "ความสำคัญ",      select:   { equals:   priority } });
    if (doneParam !== null) filters.push({ property: "เสร็จแล้ว?", checkbox: { equals: doneParam === "true" } });
    if (search)   filters.push({ property: "ชื่องาน",         title:    { contains: search   } });

    const response = await notion.databases.query({
      database_id: TASKS_DB_ID,
      filter: filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { and: filters },
      sorts: [
        { property: "ความสำคัญ", direction: "ascending" },
        { property: "Deadline",   direction: "ascending" },
      ],
      page_size: 100,
    });

    const tasks = response.results.map(mapPageToTask);
    return NextResponse.json({ tasks, total: tasks.length }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/tasks]", err);
    return NextResponse.json({ error: "ดึงข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, assigneeId, status, category, priority, deadline, note } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "กรุณาระบุชื่องาน" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      ชื่องาน: { title: [{ text: { content: name.trim() } }] },
      สถานะ:   { select: { name: status ?? "รอดำเนินการ" } },
    };

    if (category)   properties["หมวดหมู่"]     = { select:     { name: category } };
    if (priority)   properties["ความสำคัญ"]    = { select:     { name: priority } };
    if (deadline)   properties["Deadline"]      = { date:       { start: deadline } };
    if (note)       properties["หมายเหตุ"]      = { rich_text:  [{ text: { content: note } }] };
    if (assigneeId) properties["ผู้รับผิดชอบ"] = { people:     [{ id: assigneeId }] };

    const page = await notion.pages.create({
      parent: { database_id: TASKS_DB_ID },
      properties,
    });

    const newTask = mapPageToTask(page);
    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/tasks]", err);
    return NextResponse.json({ error: "สร้างงานไม่สำเร็จ" }, { status: 500 });
  }
}