import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/roadmap-auth";

/* กันคนนอกเรียก API ที่เสียค่า AI: ใช้รหัสผ่านและคุกกี้ชุดเดียวกับหน้า Roadmap
   ถ้ายังไม่ได้ตั้ง ROADMAP_PASSWORD จะถือว่าไม่ผ่านเสมอ (ปลอดภัยไว้ก่อน) */
export async function aiGuard(): Promise<NextResponse | null> {
  if (await isAuthed()) return null;
  return NextResponse.json({ error: "ต้องใส่รหัสผ่านก่อนใช้ AI", code: "auth" }, { status: 401 });
}
