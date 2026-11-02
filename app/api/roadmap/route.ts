import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/roadmap-auth";
import { AREAS, STATUSES, sb, type Area, type Phase, type Status, type Task } from "@/lib/roadmap-db";

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [phases, tasks] = await Promise.all([
      sb<Phase[]>("roadmap_phases?select=*&order=sort_order.asc,start_date.asc"),
      sb<Task[]>("roadmap_tasks?select=*&order=sort_order.asc,created_at.asc&limit=1000"),
    ]);
    return NextResponse.json({ phases, tasks });
  } catch (err) {
    console.error("[GET /api/roadmap]", err);
    return NextResponse.json({ error: "ดึงแผนไม่สำเร็จ (ตรวจว่ารัน supabase/roadmap.sql แล้ว)" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return bad("คำขอไม่ถูกต้อง");
  const d = (body.data ?? {}) as Record<string, unknown>;

  try {
    switch (body.action) {
      case "savePhase": {
        const name = text(d.name, 80);
        const area = d.area as Area;
        const start = text(d.start, 10), end = text(d.end, 10);
        if (!name) return bad("กรุณาใส่ชื่อเฟส");
        if (!AREAS.includes(area)) return bad("หมวดไม่ถูกต้อง");
        if (!DATE.test(start) || !DATE.test(end) || end < start) return bad("วันที่ไม่ถูกต้อง");
        const id = typeof d.id === "string" && d.id ? d.id : newId("p");
        if (!ID.test(id)) return bad("id ไม่ถูกต้อง");
        const row: Record<string, unknown> = { id, name, goal: text(d.goal, 200), area, start_date: start, end_date: end };
        if (!d.id) {
          const last = await sb<{ sort_order: number }[]>("roadmap_phases?select=sort_order&order=sort_order.desc&limit=1");
          row.sort_order = (last[0]?.sort_order ?? 0) + 1;
        }
        await sb("roadmap_phases?on_conflict=id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(row),
        });
        return NextResponse.json({ ok: true, id });
      }
      case "deletePhase": {
        const id = text(d.id, 64);
        if (!ID.test(id)) return bad("id ไม่ถูกต้อง");
        await sb(`roadmap_phases?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return NextResponse.json({ ok: true });
      }
      case "saveTask": {
        const title = text(d.title, 140);
        const phaseId = text(d.phaseId, 64);
        const area = d.area as Area;
        const status = (d.status ?? "todo") as Status;
        const due = text(d.due, 10);
        if (!title) return bad("กรุณาใส่ชื่องาน");
        if (!ID.test(phaseId)) return bad("เลือกเฟสไม่ถูกต้อง");
        if (!AREAS.includes(area)) return bad("หมวดไม่ถูกต้อง");
        if (!STATUSES.includes(status)) return bad("สถานะไม่ถูกต้อง");
        if (due && !DATE.test(due)) return bad("วันที่ไม่ถูกต้อง");
        const id = typeof d.id === "string" && d.id ? d.id : newId("t");
        if (!ID.test(id)) return bad("id ไม่ถูกต้อง");
        const row: Record<string, unknown> = {
          id, title, phase_id: phaseId, area, status, due: due || null, note: text(d.note, 500), updated_at: new Date().toISOString(),
        };
        if (!d.id) {
          const last = await sb<{ sort_order: number }[]>("roadmap_tasks?select=sort_order&order=sort_order.desc&limit=1");
          row.sort_order = (last[0]?.sort_order ?? 0) + 1;
        }
        await sb("roadmap_tasks?on_conflict=id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(row),
        });
        return NextResponse.json({ ok: true, id });
      }
      case "setStatus": {
        const id = text(d.id, 64);
        const status = d.status as Status;
        if (!ID.test(id) || !STATUSES.includes(status)) return bad("คำขอไม่ถูกต้อง");
        await sb(`roadmap_tasks?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
        });
        return NextResponse.json({ ok: true });
      }
      case "deleteTask": {
        const id = text(d.id, 64);
        if (!ID.test(id)) return bad("id ไม่ถูกต้อง");
        await sb(`roadmap_tasks?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return NextResponse.json({ ok: true });
      }
      default:
        return bad("ไม่รู้จักคำสั่ง");
    }
  } catch (err) {
    console.error("[POST /api/roadmap]", body.action, err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 502 });
  }
}
