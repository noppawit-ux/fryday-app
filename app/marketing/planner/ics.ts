import { PLAN } from "@/lib/content-plan";

/* สร้างไฟล์ปฏิทิน (.ics) จากแคมเปญ เปิดได้ใน iPhone / Google Calendar / Outlook
   UID คงที่ต่อคลิป: นำเข้าซ้ำแล้วปฏิทินจะอัปเดตรายการเดิมแทนการสร้างเบิ้ล */

export interface IcsItem { id: string; title: string; contentType: string | null; channels: string[]; status: string; postDate: string | null }
export interface IcsOptions { posts: boolean; shoots: boolean; includeDone: boolean }

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const d8 = (s: string) => s.replace(/-/g, "");
const nextDay = (s: string) => d8(new Date(Date.parse(s + "T00:00:00Z") + 86400000).toISOString().slice(0, 10));
const utc = (date: string, hm: string, addMin = 0) => {
  const [h, m] = hm.split(":").map(Number); // เวลาไทย UTC+7
  return new Date(Date.parse(date + "T00:00:00Z") + (h * 60 + m + addMin) * 60000 - 7 * 3600000).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
};

/* พับบรรทัดไม่เกิน 75 ไบต์ตามมาตรฐาน RFC 5545 (นับเป็นไบต์เพราะภาษาไทย 3 ไบต์/ตัวอักษร) */
function fold(line: string): string {
  const enc = new TextEncoder(); const out: string[] = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ch; bytes = n; } else { cur += ch; bytes += n; }
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(items: IcsItem[], o: IcsOptions): { text: string; count: number } {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const ev: string[][] = [];
  const planOf = (title: string) => { const n = /^คลิป (\d+):/.exec(title)?.[1]; return n ? PLAN.find((p) => String(p.no) === n) : undefined; };
  const done = (s: string) => s === "โพสต์แล้ว" || s === "วัดผล";

  if (o.posts) {
    for (const c of items) {
      if (!c.postDate || (!o.includeDone && done(c.status))) continue;
      const date = c.postDate.slice(0, 10), plan = planOf(c.title);
      const desc = [`สถานะ: ${c.status}`, c.contentType && `ประเภท/เสาหลัก: ${c.contentType}`, c.channels.length && `ช่องทาง: ${c.channels.join(", ")}`, plan && `ฮุก: ${plan.hook}`].filter(Boolean).join("\n");
      const e = ["BEGIN:VEVENT", `UID:${c.id}-post@fryday-app`, `DTSTAMP:${stamp}`, `SUMMARY:${esc("📣 โพสต์ " + c.title)}`, `DESCRIPTION:${esc(desc)}`];
      if (plan?.time && date === plan.postDate) e.push(`DTSTART:${utc(date, plan.time)}`, `DTEND:${utc(date, plan.time, 30)}`);
      else e.push(`DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`);
      e.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc("ถึงเวลาโพสต์: " + c.title)}`, "TRIGGER:-PT30M", "END:VALARM", "END:VEVENT");
      ev.push(e);
    }
  }
  if (o.shoots) {
    const byDay = new Map<string, typeof PLAN>();
    for (const p of PLAN) {
      const c = items.find((x) => planOf(x.title)?.no === p.no);
      if (!c || (!o.includeDone && done(c.status))) continue;
      byDay.set(p.shootDate, [...(byDay.get(p.shootDate) ?? []), p]);
    }
    for (const [date, clips] of byDay) {
      const desc = clips.map((p) => `คลิป ${p.no}: ${p.idea}`).join("\n") + "\n\nถ่ายทั้งหมดในวันเดียว แนวตั้ง 9:16";
      ev.push(["BEGIN:VEVENT", `UID:shoot-${date}@fryday-app`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(`🎬 ถ่ายคลิป ${clips.length} คลิป (สัปดาห์ ${clips[0].week})`)}`, `DESCRIPTION:${esc(desc)}`, `DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`, "END:VEVENT"]);
    }
  }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fryday//Content Planner//TH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Fryday คอนเทนต์", ...ev.flat(), "END:VCALENDAR"];
  return { text: lines.map(fold).join("\r\n") + "\r\n", count: ev.length };
}

export function downloadIcs(text: string, name = "fryday-content.ics") {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
