import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/roadmap-auth";
import { sb } from "@/lib/roadmap-db";
import type { Snapshot } from "@/lib/roadmap-sales";
import { salesDigest } from "@/lib/sales-digest";
import { claude, ClaudeError, extractJson, verifiedUrls } from "@/lib/anthropic";
import { loadAll, summarize } from "@/lib/content-stats";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/* วิเคราะห์ยอดขายร้าน และค้นเทรนด์วิดีโอจากเว็บ
   ต้องล็อกอินด้วยรหัสผ่านเดียวกับหน้า Roadmap (ข้อมูลยอดขายอ่อนไหว และการค้นเว็บมีค่าใช้จ่าย)
   ตัวเลขยอดขายดึงฝั่งเซิร์ฟเวอร์เอง ไม่รับจากเบราว์เซอร์ */

const FORMATS = ["พิกัดร้าน", "เมนู/ASMR", "เบื้องหลังครัว", "บอร์ดเกมในร้าน", "โปรโมชัน", "ถาม-ตอบ/โพล", "ตามเทรนด์", "รีวิวลูกค้า"];
const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const arr = (v: unknown, n: number, len = 200) => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, len)).filter(Boolean) : []);
const list = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];

const SALES_SYSTEM = `คุณเป็นนักวิเคราะห์ข้อมูลร้านอาหารขนาดเล็กในไทย หน้าที่คืออ่านข้อมูลยอดขายแล้วบอกว่าควรทำคอนเทนต์วิดีโออะไร โพสต์เมื่อไร เพื่อให้คนรู้จักร้านและมาซื้อมากขึ้น
ผู้ใช้ทำคอนเทนต์คนเดียว 3-8 ชั่วโมงต่อสัปดาห์ ถ่ายด้วยมือถือ
กฎเหล็ก:
- ใช้เฉพาะตัวเลขที่ให้มา ห้ามเดาหรือแต่งตัวเลข ทุกข้อสังเกตต้องมีตัวเลขหรือชื่อเมนูจากข้อมูลกำกับ
- ห้ามสรุปว่าโพสต์ใดทำให้ยอดขายเพิ่ม ข้อมูลโพสต์มีน้อยและมีปัจจัยอื่นปนอยู่ ให้พูดว่า "สังเกตว่า" และบอกจำนวนตัวอย่าง
- ข้อมูลรายชั่วโมงที่มีวันน้อยหรือข้อมูลที่ระบบเตือนว่าไม่ครบ ให้ระบุว่าเชื่อได้น้อย อย่าใช้เป็นข้อสรุปหลัก
- เมนูที่ไม่มีต้นทุน อย่าพูดถึงกำไรของเมนูนั้น
- ไอเดียต้องถ่ายได้จริงในร้านภายในวันเดียว ห้ามแต่งราคา โปรโมชัน หรือข้อเท็จจริงของร้านที่ไม่ได้ให้มา
- ภาษาไทยกระชับ ตอบเป็น JSON ล้วน ไม่มี markdown
รูปแบบ JSON:
{"summary":"สรุป 2-3 ประโยค","findings":[{"title":"ข้อสังเกต","evidence":"ตัวเลข/ชื่อเมนูจากข้อมูล","contentAngle":"เอาไปทำคอนเทนต์อย่างไร","confidence":"สูง|กลาง|ต่ำ"}],"heroMenus":[{"name":"ชื่อเมนูจากข้อมูล","reason":"ทำไมควรเป็นพระเอกของวิดีโอ"}],"timing":{"days":["วันที่ควรโพสต์หรือเน้น"],"hours":"ช่วงเวลาโพสต์ที่แนะนำ","reasoning":"เหตุผลจากข้อมูล"},"ideas":[{"title":"ชื่อคอนเทนต์","format":"หนึ่งใน ${FORMATS.join(" | ")}","hook":"ประโยคเปิด 3 วินาที","basedOn":"ข้อมูลที่รองรับ"}],"gaps":["ข้อมูลที่ขาดหรือไม่น่าเชื่อ และควรเก็บเพิ่มอะไร"]}
findings 3-5 ข้อ heroMenus 2-3 เมนู ideas 4-6 ข้อ`;

const TRENDS_SYSTEM = (today: string) => `คุณเป็นนักวิจัยเทรนด์วิดีโอสั้นสำหรับร้านอาหารขนาดเล็กในไทย วันนี้คือ ${today}
ใช้เครื่องมือค้นเว็บหาข้อมูลจริง แล้วสรุปว่าอะไรกำลังได้ผลกับวิดีโอสั้นของร้านอาหาร/ร้านไก่ทอด ใน TikTok, Instagram Reels, YouTube Shorts และ Facebook Reels
ร้านของผู้ใช้: Fryday ร้านไก่ทอด นั่งแอร์ได้ มีบอร์ดเกมให้เล่นในร้าน ผู้ใช้ทำคนเดียว 3-8 ชั่วโมงต่อสัปดาห์ ถ่ายด้วยมือถือ เป้าหมายคือให้คนรู้จักร้าน
กฎเหล็ก:
- รายงานเฉพาะสิ่งที่พบในผลค้นหาจริง ทุกเทรนด์ต้องมี sourceUrls อย่างน้อย 1 ลิงก์ที่ได้จากผลค้นหา ห้ามแต่ง URL
- ห้ามแต่งตัวเลขสถิติ ถ้าแหล่งไม่ได้ระบุตัวเลข ให้เล่าเป็นคำพูด
- เน้นแหล่งใหม่ ภายใน 6 เดือน และเน้นตลาดไทย ถ้าแหล่งเป็นของต่างประเทศให้บอกในช่อง evidence
- คุณตรวจเสียงฮิตหรือแฮชแท็กแบบเรียลไทม์ในแอปไม่ได้ ถ้าแหล่งพูดถึงเสียงเพลง ให้เตือนผู้ใช้ให้เช็กในแอปเองและเช็กสิทธิ์เสียงก่อนใช้
- ถ้าหาข้อมูลไม่ได้หรือแหล่งขัดแย้งกัน ให้บอกใน gaps ตรงๆ ดีกว่าเดา
- ตอบเป็น JSON ล้วน ไม่มี markdown
รูปแบบ JSON:
{"summary":"สรุป 2-3 ประโยค","trends":[{"name":"ชื่อเทรนด์","what":"คืออะไร","evidence":"สิ่งที่แหล่งบอก และอายุ/ประเทศของแหล่ง","confidence":"สูง|กลาง|ต่ำ","useForFryday":"ทำกับ Fryday อย่างไรภายใน 1 วันถ่าย","sourceUrls":["ลิงก์จากผลค้นหา"]}],"formats":[{"format":"รูปแบบวิดีโอ","note":"ทำไมได้ผลตามแหล่ง","sourceUrls":["ลิงก์"]}],"cautions":["ข้อควรระวัง เช่น ลิขสิทธิ์เสียง คำโฆษณา"],"gaps":["สิ่งที่หาไม่เจอ"]}
trends 3-6 ข้อ formats 2-4 ข้อ`;

const CONTENT_SYSTEM = `คุณเป็นที่ปรึกษาคอนเทนต์ของร้านไก่ทอด Fryday (ผู้ใช้ทำคนเดียว ~5 ชม./สัปดาห์ ถ่ายมือถือ เป้าหมายคือให้คนรู้จักร้าน)
อ่านผลจริงของคลิปที่โพสต์ 4 ช่อง และคำตอบลูกค้าหน้าร้าน แล้วร่างข้อสรุปให้เจ้าของร้านเลือก "ทำต่อ / เลิก / ลองใหม่" อย่างละ 1 ข้อ
กฎเหล็ก:
- ใช้เฉพาะตัวเลขที่ให้มา ห้ามแต่งหรือเดา ทุกข้อต้องอ้างตัวเลขหรือชื่อคลิป/เสาหลัก/ช่องจากข้อมูล
- จำนวนคลิปที่มีผลน้อย (ต่ำกว่า 8 คลิป) ให้บอกว่าเป็นแนวโน้มเบื้องต้น ห้ามฟันธง; ห้ามสรุปว่าคลิปทำให้ยอดขายเพิ่ม
- ถ้าข้อมูลยังว่างหรือไม่พอ ให้ตอบ summary ว่าข้อมูลยังไม่พอ และบอกใน gaps ว่าต้องกรอกอะไรเพิ่ม โดยปล่อย keep/drop/tryNew เป็นสตริงว่าง
- ตัวชี้วัดหลัก: Views, Shares+Saves, เข้าโปรไฟล์+ผู้ติดตามใหม่, สัดส่วนลูกค้าที่บอกรู้จักจากคลิป (ตัวที่เชื่อถือสุดสำหรับ awareness)
- ภาษาไทยกระชับ ตอบเป็น JSON ล้วน ไม่มี markdown
รูปแบบ: {"summary":"2-3 ประโยค","keep":"ทำต่อ 1 ข้อ พร้อมหลักฐาน","drop":"เลิก 1 ข้อ พร้อมหลักฐาน","tryNew":"ลองใหม่ 1 ข้อ ที่ถ่ายได้ภายใน 1 วัน","gaps":["ข้อมูลที่ขาด"]}`;

function bad(msg: string, status = 502) { return NextResponse.json({ error: msg }, { status }); }

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const mode = body?.mode;

  try {
    if (mode === "sales") {
      const snapshot = await sb<Snapshot>("rpc/roadmap_snapshot", { method: "POST", body: "{}" });
      if (!snapshot) return bad("ไม่พบข้อมูลยอดขาย");
      const posts = list(body?.posts).slice(0, 40).map((p) =>
        `- ${s(p.title, 80)} | ${s(p.type, 20)} | ${arr(p.channels, 5, 20).join("/")} | วันที่ ${s(p.date, 10) || "-"} | reach ${Number(p.reach) || 0}, engagement ${Number(p.engagement) || 0}, ยอดขายที่บันทึกว่าเพิ่ม ${Number(p.sales) || 0}`);
      const user = `${salesDigest(snapshot)}\n\nโพสต์ที่เคยทำ (${posts.length} รายการ${posts.length < 10 ? " ซึ่งน้อยเกินกว่าจะสรุปแนวโน้มได้แน่นอน" : ""}):\n${posts.join("\n") || "- ยังไม่มีข้อมูล"}`;
      const { text } = await claude({ system: SALES_SYSTEM, user, maxTokens: 3500 });
      const o = (extractJson(text) ?? {}) as Record<string, unknown>;
      return NextResponse.json({
        asOf: snapshot.asOf,
        postsUsed: posts.length,
        result: {
          summary: s(o.summary, 600),
          findings: list(o.findings).slice(0, 6).map((f) => ({ title: s(f.title, 120), evidence: s(f.evidence, 300), contentAngle: s(f.contentAngle, 300), confidence: s(f.confidence, 10) })).filter((f) => f.title),
          heroMenus: list(o.heroMenus).slice(0, 4).map((m) => ({ name: s(m.name, 80), reason: s(m.reason, 250) })).filter((m) => m.name),
          timing: { days: arr((o.timing as Record<string, unknown>)?.days, 7, 30), hours: s((o.timing as Record<string, unknown>)?.hours, 120), reasoning: s((o.timing as Record<string, unknown>)?.reasoning, 400) },
          ideas: list(o.ideas).slice(0, 8).map((i) => ({ title: s(i.title, 120), format: FORMATS.includes(s(i.format, 30)) ? s(i.format, 30) : "ตามเทรนด์", hook: s(i.hook, 200), basedOn: s(i.basedOn, 250) })).filter((i) => i.title),
          gaps: arr(o.gaps, 6, 250),
        },
      });
    }

    if (mode === "trends") {
      const focus = s(body?.focus, 300), channel = s(body?.channel, 30);
      const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      const user = `ค้นหาเทรนด์วิดีโอสั้นล่าสุดสำหรับร้านอาหารและร้านไก่ทอดในไทย${channel ? ` เน้นช่องทาง ${channel}` : ""}${focus ? `\nเรื่องที่อยากให้เจาะเพิ่ม: ${focus}` : ""}`;
      const { text, sources } = await claude({ system: TRENDS_SYSTEM(today), user, maxTokens: 4000, webSearch: { maxUses: 4 } });
      if (!sources.length) return bad("ค้นเว็บแล้วไม่พบแหล่งข้อมูล ลองกดใหม่หรือเปลี่ยนหัวข้อที่เจาะ");
      const o = (extractJson(text) ?? {}) as Record<string, unknown>;
      const trends = list(o.trends).slice(0, 8).map((t) => ({
        name: s(t.name, 120), what: s(t.what, 400), evidence: s(t.evidence, 400), confidence: s(t.confidence, 10),
        useForFryday: s(t.useForFryday, 400), sources: verifiedUrls(t.sourceUrls, sources),
      })).filter((t) => t.name && t.sources.length); // ตัดเทรนด์ที่ไม่มีแหล่งอ้างอิงที่ยืนยันได้
      const formats = list(o.formats).slice(0, 5).map((f) => ({ format: s(f.format, 100), note: s(f.note, 300), sources: verifiedUrls(f.sourceUrls, sources) })).filter((f) => f.format && f.sources.length);
      return NextResponse.json({
        fetchedAt: new Date().toISOString(),
        sourcesFound: sources.length,
        result: { summary: s(o.summary, 600), trends, formats, cautions: arr(o.cautions, 6, 250), gaps: arr(o.gaps, 6, 250) },
      });
    }
    if (mode === "content") {
      const { clips, survey } = await loadAll();
      const sum = summarize(clips, survey);
      const withData = clips.filter((c) => Object.keys(c.results).length);
      const f = (v: number | null) => (v === null ? "-" : (v * 100).toFixed(1) + "%");
      const lines = [
        `คลิปที่มีผลบันทึกแล้ว ${withData.length} จาก ${clips.length} คลิป`,
        "รายสัปดาห์:", ...sum.weekly.map((w) => `- สัปดาห์ ${w.week} (${w.theme}): views ${w.views}, shares+saves ${w.shareSave} (${f(w.shareSavePct)}), เข้าโปรไฟล์ ${w.profile}, ผู้ติดตามใหม่ ${w.followers}, ลูกค้าตอบ ${w.asked} คน รู้จักจากคลิป ${w.fromClip} (${f(w.fromClipPct)})`),
        "ตามเสาหลัก:", ...sum.pillars.map((p) => `- ${p.pillar}: โพสต์ ${p.posted} คลิป views รวม ${p.views} เฉลี่ย ${p.avgViews === null ? "-" : Math.round(p.avgViews)} share+save ${f(p.shareSavePct)}`),
        "ตามช่อง:", ...sum.channels.map((c) => `- ${c.channel}: views ${c.views}, ผู้ติดตามใหม่ ${c.followers}, share+save ${f(c.shareSavePct)}`),
        "รายคลิป:", ...withData.slice(0, 20).map((c) => `- ${c.title} [${c.pillar}] ` + Object.entries(c.results).map(([ch, r]) => `${ch}: views ${r.views ?? "-"}, share ${r.shares ?? "-"}, save ${r.saves ?? "-"}`).join(" | ")),
      ].join("\n");
      const { text } = await claude({ system: CONTENT_SYSTEM, user: lines, maxTokens: 1500 });
      const o = (extractJson(text) ?? {}) as Record<string, unknown>;
      return NextResponse.json({ clipsUsed: withData.length, result: { summary: s(o.summary, 600), keep: s(o.keep, 400), drop: s(o.drop, 400), tryNew: s(o.tryNew, 400), gaps: arr(o.gaps, 5, 250) } });
    }

    return bad("ไม่รู้จักโหมดนี้", 400);
  } catch (err) {
    console.error("[POST /api/marketing/analyze]", err);
    if (err instanceof ClaudeError && err.kind === "websearch") return bad("บัญชี Anthropic ยังไม่เปิดใช้เครื่องมือค้นเว็บ (เปิดได้ที่ Console > Settings > Privacy หรือ Web search)");
    if (err instanceof ClaudeError && err.kind === "config") return bad(err.message, 500);
    return bad("วิเคราะห์ไม่สำเร็จ ลองกดใหม่อีกครั้ง");
  }
}
