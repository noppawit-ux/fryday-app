import { NextRequest, NextResponse } from "next/server";
import {
  ROADMAP_COOKIE,
  SESSION_SECONDS,
  makeSessionToken,
  passwordMatches,
} from "@/lib/roadmap-auth";

// กันเดารหัสแบบหยาบๆ (นับต่อ instance เท่านั้น ไม่ใช่ตัวกันที่สมบูรณ์)
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  if (!process.env.ROADMAP_PASSWORD) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้ง ROADMAP_PASSWORD ใน Vercel" }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rec = fails.get(ip);
  if (rec && rec.until > Date.now()) {
    return NextResponse.json({ error: "ลองผิดหลายครั้ง รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!passwordMatches(password)) {
    const n = (rec?.n ?? 0) + 1;
    fails.set(ip, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  fails.delete(ip);
  const token = makeSessionToken()!;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ROADMAP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ROADMAP_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
