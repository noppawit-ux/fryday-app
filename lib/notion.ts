import { Client } from "@notionhq/client";

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});
export const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID!;

export type TaskStatus = "รอดำเนินการ" | "กำลังทำ" | "เสร็จแล้ว" | "ติดปัญหา";
export type TaskPriority = "ด่วนมาก" | "ปานกลาง" | "ไม่เร่งด่วน";
export type TaskCategory = "ครัว" | "การเงิน" | "การตลาด" | "ทั่วไป" | "HR";

export interface FrydayTask {
  id: string;
  name: string;
  assignee: string | null;
  assigneeAvatar: string | null;
  status: TaskStatus;
  category: TaskCategory;
  priority: TaskPriority;
  deadline: string | null;
  done: boolean;
  note: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(prop: any): string | null {
  if (!prop) return null;
  if (prop.type === "title" && prop.title?.length > 0)
    return prop.title.map((t: { plain_text: string }) => t.plain_text).join("");
  if (prop.type === "rich_text" && prop.rich_text?.length > 0)
    return prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join("");
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPageToTask(page: any): FrydayTask {
  const props = page.properties;
  return {
    id: page.id,
    name: extractText(props["ชื่องาน"]) ?? "(ไม่มีชื่อ)",
    assignee: props["ผู้รับผิดชอบ"]?.people?.[0]?.name ?? null,
    assigneeAvatar: props["ผู้รับผิดชอบ"]?.people?.[0]?.avatar_url ?? null,
    status: (props["สถานะ"]?.select?.name as TaskStatus) ?? "รอดำเนินการ",
    category: (props["หมวดหมู่"]?.select?.name as TaskCategory) ?? "ทั่วไป",
    priority: (props["ความสำคัญ"]?.select?.name as TaskPriority) ?? "ปานกลาง",
    deadline: props["Deadline"]?.date?.start ?? null,
    done: props["เสร็จแล้ว?"]?.checkbox ?? false,
    note: extractText(props["หมายเหตุ"]),
    createdAt: page.created_time,
  };
}