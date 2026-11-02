import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ROADMAP_COOKIE = "roadmap_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 14; // 14 วัน

// กุญแจเซ็นคุกกี้ได้จากรหัสผ่านเอง: เปลี่ยนรหัสผ่านเมื่อไร ทุกเซสชันเดิมใช้ไม่ได้ทันที
function sessionKey(): Buffer | null {
  const password = process.env.ROADMAP_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update("fryday-roadmap-session").digest();
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string): boolean {
  const password = process.env.ROADMAP_PASSWORD;
  if (!password) return false;
  return safeEqual(input, password);
}

export function makeSessionToken(): string | null {
  const key = sessionKey();
  if (!key) return null;
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${expires}.${sign(expires, key)}`;
}

export async function isAuthed(): Promise<boolean> {
  const key = sessionKey();
  if (!key) return false;
  const store = await cookies();
  const token = store.get(ROADMAP_COOKIE)?.value;
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires, key))) return false;
  return Number(expires) > Date.now() / 1000;
}
