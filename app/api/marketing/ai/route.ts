import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/* ตัวช่วยคิดไอเดียและเขียนสคริปต์คอนเทนต์ ใช้ ANTHROPIC_API_KEY ตัวเดียวกับหน้า AI Chat
   system prompt ถูกกำหนดฝั่งเซิร์ฟเวอร์ทั้งหมด หน้าเว็บส่งได้แค่ข้อมูลโจทย์ ไม่ส่ง prompt เอง */

const MODEL = process.env.MARKETING_AI_MODEL ?? "claude-sonnet-4-6";

const FORMATS = ["พิกัดร้าน", "เมนู/ASMR", "เบื้องหลังครัว", "บอร์ดเกมในร้าน", "โปรโมชัน", "ถาม-ตอบ/โพล", "ตามเทรนด์", "รีวิวลูกค้า"] as const;
const CHANNELS = ["Facebook", "Instagram", "TikTok", "YouTube Shorts"] as const;

const BASE_RULES = `คุณเป็นนักวางแผนคอนเทนต์โซเชียลของร้านอาหารขนาดเล็กในประเทศไทย
ผู้ใช้ทำคอนเทนต์คนเดียว ใช้เวลาราว 3-8 ชั่วโมงต่อสัปดาห์ ถ่ายด้วยมือถือ งบ 0 บาท เป้าหมายคือให้คนรู้จักร้าน (awareness)
กฎ:
- ไอเดียและสคริปต์ต้องถ่ายได้จริงในร้านภายในวันเดียว ใช้ของที่ร้านมีอยู่แล้ว
- ห้ามแต่งราคา โปรโมชัน ชื่อเมนู สถิติ หรือข้อเท็จจริงของร้านที่ผู้ใช้ไม่ได้ให้มา ถ้าจำเป็นต้องมีให้เขียนเป็นช่องว่าง เช่น [ใส่ราคา]
- คุณไม่เห็นเทรนด์ปัจจุบัน ถ้าผู้ใช้ให้เทรนด์หรือเสียงมา ให้ใช้ตามนั้น ถ้าไม่ได้ให้ ห้ามอ้างว่าอะไรกำลังฮิต
- ภาษาไทยที่คนพูดจริง กระชับ ข้อความบนจอแต่ละบรรทัดไม่เกิน 8 คำ
- ตอบเป็น JSON ล้วน ไม่มีข้อความนอก JSON ไม่มี markdown`;

interface Ideas { mode: "ideas"; brand: string; channel: string; formats: string[]; count: number; theme: string; existing: string[] }
interface Script { mode: "script"; brand: string; title: string; format: string; duration: number; channel: string; notes: string }

const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

function parse(body: unknown): Ideas | Script | null {
  const b = body as Record<string, unknown>;
  if (b?.mode === "ideas") {
    const formats = Array.isArray(b.formats) ? b.formats.map((x) => s(x, 30)).filter((x) => (FORMATS as readonly string[]).includes(x)) : [];
    return {
      mode: "ideas",
      brand: s(b.brand, 1500),
      channel: s(b.channel, 30),
      formats,
      count: Math.min(10, Math.max(1, Number(b.count) || 5)),
      theme: s(b.theme, 1800),
      existing: Array.isArray(b.existing) ? b.existing.slice(0, 40).map((x) => s(x, 80)) : [],
    };
  }
  if (b?.mode === "script") {
    if (!s(b.title, 200).trim()) return null;
    return {
      mode: "script",
      brand: s(b.brand, 1500),
      title: s(b.title, 200),
      format: s(b.format, 30),
      duration: [15, 30, 45, 60].includes(Number(b.duration)) ? Number(b.duration) : 30,
      channel: s(b.channel, 30),
      notes: s(b.notes, 800),
    };
  }
  return null;
}

function prompts(p: Ideas | Script): { system: string; user: string } {
  if (p.mode === "ideas") {
    return {
      system: `${BASE_RULES}
ให้คิดไอเดียคอนเทนต์ใหม่ ตอบเป็น JSON array ของ object รูปแบบ:
{"title":"ชื่อโพสต์สั้น","format":"หนึ่งใน ${FORMATS.join(" | ")}","channels":["จาก ${CHANNELS.join(" | ")}"],"hook":"ประโยคเปิด 3 วินาทีแรก","why":"เหตุผลสั้นๆ ว่าทำไมคนจะดูหรือแชร์","effort":"ง่าย|กลาง|ยาก (เวลาถ่ายและตัดต่อ)"}
ไอเดียต้องต่างกันจริง ไม่ซ้ำกับรายการที่มีอยู่`,
      user: [
        `ข้อมูลร้าน:\n${p.brand || "(ไม่ได้ระบุ)"}`,
        `ช่องทางที่เน้น: ${p.channel || "ทุกช่องทาง"}`,
        `รูปแบบที่ต้องการ: ${p.formats.length ? p.formats.join(", ") : "ผสมหลายรูปแบบ"}`,
        p.theme ? `ธีม/เทรนด์/เหตุการณ์ที่ผู้ใช้ให้มา:\n${p.theme}` : "",
        p.existing.length ? `ไอเดียที่มีอยู่แล้ว (อย่าซ้ำ):\n- ${p.existing.join("\n- ")}` : "",
        `จำนวน: ${p.count} ไอเดีย`,
      ].filter(Boolean).join("\n\n"),
    };
  }
  const extra = p.format === "พิกัดร้าน"
    ? "\nรูปแบบ พิกัดร้าน: เปิดด้วยชื่อร้าน ตามด้วยภาพเส้นทางขับรถ 2-3 ช่วงพร้อมข้อความนำทาง จุดสังเกต หน้าร้าน บรรยากาศในร้าน ที่อยู่และเวลาเปิดปิด ปิดด้วยโลโก้และชื่อบัญชี (ผู้ใช้มีเครื่องมือ Studio ทำคลิปแบบนี้ในแอป)"
    : "";
  return {
    system: `${BASE_RULES}${extra}
ให้เขียนสคริปต์คลิปแนวตั้ง ตอบเป็น JSON object รูปแบบ:
{"hook":"ประโยคเปิดที่หยุดนิ้วใน 3 วินาที","shots":[{"t":"0-3","visual":"สิ่งที่ต้องเห็นในภาพ/ท่าถ่าย","onscreen":"ข้อความบนจอ","voice":"คำพูดหรือเสียงพากย์ (ว่างได้)"}],"caption":"แคปชันพร้อมโพสต์","hashtags":["#..."],"cta":"ประโยคชวนทำต่อ","props":["ของที่ต้องเตรียม"],"tips":["เคล็ดลับการถ่าย"]}
shots ให้รวมเวลาไม่เกินความยาวที่ขอ ใช้ 4-8 ช็อต แฮชแท็ก 5-8 อัน`,
    user: [
      `ข้อมูลร้าน:\n${p.brand || "(ไม่ได้ระบุ)"}`,
      `ชื่อคอนเทนต์: ${p.title}`,
      `รูปแบบ: ${p.format || "ไม่ระบุ"}`,
      `ความยาว: ${p.duration} วินาที`,
      `ช่องทาง: ${p.channel || "ทุกช่องทาง"}`,
      p.notes ? `ข้อมูล/ข้อกำหนดเพิ่มเติม:\n${p.notes}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}

function extractJson(text: string): unknown {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (start < 0 || end < start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์" }, { status: 500 });
  }
  const p = parse(await req.json().catch(() => null));
  if (!p) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  try {
    const { system, user } = prompts(p);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system, messages: [{ role: "user", content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[POST /api/marketing/ai]", data);
      return NextResponse.json({ error: "เรียก AI ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
    }
    const raw: string = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    const json = extractJson(raw);

    if (p.mode === "ideas") {
      const items = (Array.isArray(json) ? json : []).slice(0, p.count).map((i: Record<string, unknown>) => ({
        title: s(i.title, 120),
        format: (FORMATS as readonly string[]).includes(s(i.format, 30)) ? s(i.format, 30) : "ตามเทรนด์",
        channels: (Array.isArray(i.channels) ? i.channels : []).map((c) => s(c, 20)).filter((c) => (CHANNELS as readonly string[]).includes(c)),
        hook: s(i.hook, 200), why: s(i.why, 300), effort: s(i.effort, 10),
      })).filter((i) => i.title);
      return NextResponse.json({ items });
    }
    const o = (json ?? {}) as Record<string, unknown>;
    const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, 200)).filter(Boolean) : []);
    const shots = (Array.isArray(o.shots) ? o.shots : []).slice(0, 12).map((x: Record<string, unknown>) => ({
      t: s(x.t, 12), visual: s(x.visual, 300), onscreen: s(x.onscreen, 120), voice: s(x.voice, 300),
    }));
    return NextResponse.json({ script: { hook: s(o.hook, 200), shots, caption: s(o.caption, 1500), hashtags: arr(o.hashtags, 10), cta: s(o.cta, 200), props: arr(o.props, 10), tips: arr(o.tips, 8) } });
  } catch (err) {
    console.error("[POST /api/marketing/ai]", err);
    return NextResponse.json({ error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ ลองกดสร้างใหม่" }, { status: 502 });
  }
}
