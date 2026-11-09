import { DOW, chanStats, dataNotes, fmtDate, hrLabel, num, type Snapshot } from "@/lib/roadmap-sales";

/* สรุปยอดขายเป็นข้อความสั้นๆ ให้ AI อ่าน (สร้างฝั่งเซิร์ฟเวอร์จาก snapshot เท่านั้น)
   ไม่ส่งรายจ่าย/กำไรรายเดือน ส่งเฉพาะตัวเลขที่ใช้ตัดสินใจเรื่องคอนเทนต์ */

const r0 = (x: unknown) => Math.round(num(x)).toLocaleString("en-US");

export function salesDigest(s: Snapshot): string {
  const L: string[] = [];
  L.push(`ข้อมูลถึงวันที่ ${s.asOf}`);

  const weeks = [...(s.weekly ?? [])].sort((a, b) => (a.week_start < b.week_start ? -1 : 1)).slice(-8);
  if (weeks.length) {
    L.push("\nยอดรวมรายสัปดาห์ (บาท, วันที่เปิดขาย):");
    weeks.forEach((w) => L.push(`- สัปดาห์เริ่ม ${fmtDate(w.week_start)}: ${r0(w.total)} (${num(w.open_days)} วัน)`));
  }

  const dow = [...(s.dow ?? [])].sort((a, b) => num(b.avg_total) - num(a.avg_total));
  if (dow.length) {
    L.push("\nยอดเฉลี่ยต่อวันตามวันในสัปดาห์ (สูง→ต่ำ):");
    dow.forEach((d) => L.push(`- ${DOW[num(d.dow)] ?? d.dow}: ${r0(d.avg_total)}`));
  }

  const hours = [...(s.hourly ?? [])].sort((a, b) => num(b.total) - num(a.total)).slice(0, 6);
  if (hours.length) {
    L.push("\nชั่วโมงที่ขายดีที่สุด (ยอดรวม, จำนวนวันที่มีข้อมูล):");
    hours.forEach((h) => L.push(`- ${hrLabel(h.hr)}: ${r0(h.total)} (${num(h.days)} วัน)`));
  }

  const cs = chanStats(s);
  if (cs) {
    L.push("\nช่องทางขาย:");
    L.push(`- 4 สัปดาห์ล่าสุด: หน้าร้าน ${r0(cs.last4.s)}, เดลิเวอรี ${r0(cs.last4.d)} (เดลิเวอรี ${cs.last4.share ?? "-"}%)`);
    L.push(`- 4 สัปดาห์ก่อนหน้า: หน้าร้าน ${r0(cs.prev4.s)}, เดลิเวอรี ${r0(cs.prev4.d)} (เดลิเวอรี ${cs.prev4.share ?? "-"}%)`);
  }

  const menus = [...(s.menus ?? [])].sort((a, b) => num(b.revenue) - num(a.revenue)).slice(0, 12);
  if (menus.length) {
    L.push("\nเมนูขายดีตามรายได้ (ชื่อ, จำนวน, รายได้, อัตรากำไรขั้นต้นถ้ามีต้นทุน):");
    menus.forEach((m) => {
      const price = num(m.price), cost = m.cost == null ? null : num(m.cost);
      const margin = price > 0 && cost != null ? `${Math.round(((price - cost) / price) * 100)}%` : "ไม่มีต้นทุน";
      L.push(`- ${m.name}: ${num(m.qty)} ชิ้น, ${r0(m.revenue)} บาท, กำไรขั้นต้น ${margin}`);
    });
  }

  const top = (ch: "store" | "delivery") => (s.topByChannel ?? []).filter((x) => x.ch === ch && num(x.rn) <= 5).sort((a, b) => num(a.rn) - num(b.rn)).map((x) => `${x.name} (${num(x.qty)})`).join(", ");
  if ((s.topByChannel ?? []).length) {
    L.push(`\nเมนูขายดีหน้าร้าน: ${top("store") || "-"}`);
    L.push(`เมนูขายดีเดลิเวอรี: ${top("delivery") || "-"}`);
  }

  const notes = dataNotes(s);
  L.push("\nข้อควรระวังเรื่องคุณภาพข้อมูล (ต้องนำมาประกอบการสรุปเสมอ):");
  L.push(notes.length ? notes.map((n) => `- ${n}`).join("\n") : "- ไม่พบความผิดปกติที่ระบบตรวจได้");
  return L.join("\n");
}
