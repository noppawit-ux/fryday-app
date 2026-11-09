import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODEL = process.env.CHAT_AI_MODEL ?? process.env.MARKETING_AI_MODEL ?? "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ (ตรวจว่าเลือกครบทุก Environment ใน Vercel แล้ว Redeploy)" }, { status: 500 });
    }
    const { messages, systemPrompt } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: systemPrompt, messages }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail: string = data?.error?.message ?? `HTTP ${response.status}`;
      console.error("[POST /api/chat]", response.status, detail);
      return NextResponse.json({ error: "เรียก AI ไม่สำเร็จ", detail }, { status: 502 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[POST /api/chat]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
