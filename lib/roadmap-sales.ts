// คำนวณตัวเลขสำหรับแผงยอดขายใน Roadmap จาก snapshot ของ roadmap_snapshot()
export interface Snapshot {
  asOf: string;
  weekly: { week_start: string; total: number; open_days: number }[];
  daily: { sale_date: string; total_received: number }[];
  dow: { dow: number; avg_total: number }[];
  hourly: { hr: number; total: number; days: number }[];
  menus: { name: string; qty: number; revenue: number; price: number | null; cost: number | null }[];
  monthly: { month: string; net_revenue: number; total_expense: number; net_profit: number }[];
  channelWeekly: { week_start: string; delivery: number; store: number }[];
  platforms: { platform: string; days28: number; gross28: number; gp28: number; last_day: string }[];
  gpSettings: { platform: string; gp_percent: number }[];
  topByChannel: { ch: "delivery" | "store"; name: string; qty: number; revenue: number; rn: number }[];
  costCoverage: { withCost: number; total: number };
  zeroDays28: number;
  rows28: number;
  billZeroDays14: number;
}

export const DOW = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
export const PLAT: Record<string, string> = { grabfood: "GrabFood", lineman: "LINE MAN", shopeefood: "ShopeeFood" };

const n = (x: unknown) => {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
};
export const num = n;
export const baht = (x: unknown) => "฿" + n(x).toLocaleString("th-TH", { maximumFractionDigits: 0 });
export const kfmt = (x: unknown) => (n(x) >= 1000 ? Math.round(n(x) / 100) / 10 + "k" : String(Math.round(n(x))));
export const hrLabel = (h: unknown) => String(n(h)).padStart(2, "0") + ":00";

export function fmtDate(iso: string): string {
  const t = Date.parse(iso + "T00:00:00Z");
  return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
}
export function monthLabel(iso: string): string {
  const t = Date.parse(iso + "T00:00:00Z");
  return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("th-TH", { month: "short", year: "2-digit", timeZone: "UTC" });
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

export function snapStats(s: Snapshot) {
  const daily = [...s.daily].sort((a, b) => (a.sale_date < b.sale_date ? -1 : 1));
  const t7 = sum(daily.slice(-7), (x) => n(x.total_received));
  const p7 = sum(daily.slice(-14, -7), (x) => n(x.total_received));
  const openDays = sum(s.weekly, (w) => n(w.open_days));
  const avgOpen = openDays ? sum(s.weekly, (w) => n(w.total)) / openDays : 0;
  const dow = [...s.dow].sort((a, b) => n(b.avg_total) - n(a.avg_total));
  const hours = [...s.hourly].sort((a, b) => n(b.total) - n(a.total));
  const thinMonths = s.monthly.filter((m) => n(m.total_expense) < n(m.net_revenue) * 0.3).map((m) => m.month);
  return {
    t7, p7,
    delta: p7 > 0 ? Math.round(((t7 - p7) / p7) * 100) : null,
    avgOpen,
    bestDow: dow[0],
    peak: hours.slice(0, 3).map((h) => n(h.hr)).sort((a, b) => a - b),
    quiet: hours.slice(-2).map((h) => n(h.hr)).sort((a, b) => a - b),
    maxHourDays: Math.max(0, ...s.hourly.map((h) => n(h.days))),
    thinMonths,
  };
}

export function chanStats(s: Snapshot) {
  const w = [...(s.channelWeekly ?? [])].sort((a, b) => (a.week_start < b.week_start ? -1 : 1));
  if (!w.length) return null;
  const agg = (a: typeof w) => {
    const d = sum(a, (x) => n(x.delivery)), st = sum(a, (x) => n(x.store));
    return { d, s: st, share: d + st > 0 ? Math.round((d / (d + st)) * 100) : null };
  };
  const gps: Record<string, number> = {};
  (s.gpSettings ?? []).forEach((g) => (gps[g.platform] = n(g.gp_percent)));
  const pg = sum(s.platforms ?? [], (x) => n(x.gross28));
  const pgp = sum(s.platforms ?? [], (x) => n(x.gp28));
  return { weeks: w, last4: agg(w.slice(-4)), prev4: agg(w.slice(-8, -4)), gps, platGross: pg, gpPct: pg > 0 ? Math.round((pgp / pg) * 100) : null };
}

export function dataNotes(s: Snapshot): string[] {
  const out: string[] = [];
  const st = snapStats(s), cs = chanStats(s);
  if (n(s.zeroDays28) > 0) out.push(`ยอดขายเป็น 0 จำนวน ${n(s.zeroDays28)} วันจาก ${n(s.rows28)} วันล่าสุด ตรวจว่าร้านปิดหรือยังไม่ได้ลงยอด`);
  if (n(s.billZeroDays14) > 0) out.push(`${n(s.billZeroDays14)} วันจาก 14 วันล่าสุดมียอดขายแต่จำนวนบิลเป็น 0 ค่าเฉลี่ยต่อบิลจึงยังเชื่อไม่ได้`);
  if (st.thinMonths.length) out.push(`รายจ่ายเดือน ${st.thinMonths.map(monthLabel).join(", ")} ต่ำกว่า 30% ของรายได้สุทธิ กำไรที่เห็นอาจสูงเกินจริง`);
  if (cs) {
    if (cs.last4.d > 0 && cs.platGross < cs.last4.d * 0.5)
      out.push(`ยอดแพลตฟอร์มในตาราง delivery (${baht(cs.platGross)} ใน 28 วัน) ต่ำกว่ายอดเมนูเดลิเวอรี (ประมาณ ${baht(cs.last4.d)} ใน 4 สัปดาห์) มาก ข้อมูลแพลตฟอร์มยังไม่ครบ`);
    (s.platforms ?? []).forEach((x) => {
      if (daysBetween(x.last_day, s.asOf) > 7) out.push(`${PLAT[x.platform] ?? x.platform} ไม่มีข้อมูลตั้งแต่ ${fmtDate(x.last_day)}`);
    });
    const g0 = Object.values(cs.gps)[0];
    if (cs.gpPct != null && g0 != null && Math.abs(cs.gpPct - g0) >= 5)
      out.push(`GP จริงที่บันทึกไว้ประมาณ ${cs.gpPct}% ต่างจากที่ตั้งไว้ ${g0}% ควรเทียบกับใบสรุปของแพลตฟอร์มว่าตัวเลข GP นี้รวมอะไรบ้าง`);
  }
  if (st.maxHourDays && st.maxHourDays < 28) out.push(`ข้อมูลรายชั่วโมงมีไม่เกิน ${st.maxHourDays} วันจาก 28 วันล่าสุด`);
  if (s.costCoverage.total && s.costCoverage.withCost < s.costCoverage.total)
    out.push(`มีต้นทุนแล้ว ${s.costCoverage.withCost} จาก ${s.costCoverage.total} เมนู การดูกำไรต่อเมนูยังไม่ครบ`);
  return out;
}

// สัญญาณสั้นๆ ที่แสดงรวมกับสัญญาณของแผนงาน
export function salesSignals(s: Snapshot): { sev: "warn" | "info"; text: string }[] {
  const out: { sev: "warn" | "info"; text: string }[] = [];
  const st = snapStats(s), cs = chanStats(s);
  if (st.thinMonths.length) out.push({ sev: "warn", text: `รายจ่ายเดือน ${st.thinMonths.map(monthLabel).join(", ")} ในระบบบัญชีต่ำผิดปกติ กำไรที่เห็นอาจสูงเกินจริง` });
  if (cs && cs.prev4.s > 0 && cs.last4.s < cs.prev4.s * 0.75)
    out.push({ sev: "warn", text: `ยอดหน้าร้าน 4 สัปดาห์ล่าสุดลดลง ${Math.round((1 - cs.last4.s / cs.prev4.s) * 100)}% จาก 4 สัปดาห์ก่อน ขณะที่เดลิเวอรีเป็น ${cs.last4.share}% ของยอดทั้งหมด` });
  if (n(s.zeroDays28) > 0) out.push({ sev: "info", text: `มี ${n(s.zeroDays28)} วันใน 28 วันล่าสุดที่ยอดขายเป็น 0 ตรวจว่าร้านปิดจริงหรือยังไม่ได้ลงยอด` });
  return out;
}
