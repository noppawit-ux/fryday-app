import { NextResponse } from "next/server";
import { notion } from "@/lib/notion";
import { toBlocks } from "@/lib/notion-notes";
import { isAuthed } from "@/lib/roadmap-auth";
import { PLAN, REEL_CHANNELS } from "@/lib/content-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* นำเข้าแผน 16 คลิปจากไฟล์ Fryday_Content_System.xlsx เป็นแคมเปญใน Notion (ข้ามคลิปที่มีอยู่แล้ว กดซ้ำได้ไม่เบิ้ล) */

const titleOf = (c: (typeof PLAN)[number]) => `คลิป ${c.no}: ${c.idea}`.slice(0, 190);
const noOf = (t: string) => /^คลิป (\d+):/.exec(t)?.[1];

async function existingNos(): Promise<Set<string>> {
  const set = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({ database_id: process.env.NOTION_MARKETING_DB_ID!, start_cursor: cursor, page_size: 100 });
    for (const p of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = ((p as any).properties["ชื่อแคมเปญ/โพสต์"]?.title ?? []).map((x: { plain_text: string }) => x.plain_text).join("");
      const no = noOf(t); if (no) set.add(no);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return set;
}

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const have = await existingNos();
    return NextResponse.json({ total: PLAN.length, imported: PLAN.filter((c) => have.has(String(c.no))).length });
  } catch (err) {
    console.error("[GET seed-plan]", err);
    return NextResponse.json({ error: "ตรวจแผนไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const have = await existingNos();
    let created = 0;
    for (const c of PLAN) {
      if (have.has(String(c.no))) continue;
      const notes = [
        `สัปดาห์ ${c.week} · เสาหลัก: ${c.pillar} · เมนู/จุดเด่น: ${c.menu}`,
        `โพสต์: ${c.postDate} เวลา ${c.time} · วันถ่าย: ${c.shootDate}`,
        "", `ฮุก 3 วินาทีแรก: ${c.hook}`, "", `ช็อตที่ต้องถ่าย: ${c.shots}`, "", `แคปชัน (ร่าง): ${c.caption}`, "", `แฮชแท็ก: ${c.hashtags}`,
        "", "หมายเหตุ: ตรวจข้อมูลในช่อง [ ] ให้ตรงร้านจริง และขออนุญาตลูกค้าก่อนถ่าย/โพสต์ถ้ามีลูกค้าเข้ากล้อง",
      ].join("\n");
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_MARKETING_DB_ID! },
        properties: {
          "ชื่อแคมเปญ/โพสต์": { title: [{ text: { content: titleOf(c) } }] },
          "สถานะ": { select: { name: "ยังไม่ถ่าย" } },
          "ประเภท Content": { select: { name: c.pillar } },
          "ช่องทาง": { multi_select: REEL_CHANNELS.map((name) => ({ name })) },
          "วันที่โพสต์": { date: { start: c.postDate } },
        },
        children: toBlocks(notes),
      });
      created++;
    }
    return NextResponse.json({ created, skipped: PLAN.length - created });
  } catch (err) {
    console.error("[POST seed-plan]", err);
    return NextResponse.json({ error: "นำเข้าไม่สำเร็จ", detail: err instanceof Error ? err.message.slice(0, 200) : "" }, { status: 500 });
  }
}
