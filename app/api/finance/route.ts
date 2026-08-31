import { NextRequest, NextResponse } from "next/server";
import { notion } from "@/lib/notion";


const FINANCE_DB_ID = process.env.NOTION_FINANCE_DB_ID!;
const SUPABASE_URL = "https://razqsirgbwixjrbihaou.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

export type TransactionType = "รายรับ" | "รายจ่าย";
export type PaymentChannel = "เงินสด" | "โอนธนาคาร" | "QR Code" | "บัตรเครดิต";
export type FinanceCategory =
  | "ยอดขาย" | "วัตถุดิบ" | "ค่าแรง" | "ค่าเช่า"
  | "ค่าน้ำ/ไฟ" | "อุปกรณ์" | "การตลาด" | "อื่นๆ";

export interface FrydayTransaction {
  id: string;
  title: string;
  date: string | null;
  type: TransactionType;
  category: FinanceCategory;
  amount: number;
  netAmount: number;      // บวกถ้ารายรับ, ลบถ้ารายจ่าย
  sharePerPerson: number; // netAmount / 3
  channel: PaymentChannel | null;
  recordedBy: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPageToTransaction(page: any): FrydayTransaction {
  const props = page.properties;
  const type: TransactionType = props["ประเภท"]?.select?.name ?? "รายรับ";
  const amount: number = props["จำนวนเงิน (บาท)"]?.number ?? 0;
  const netAmount = type === "รายรับ" ? amount : -amount;
  return {
    id: page.id,
    title:
      props["วัน/รายการ"]?.title
        ?.map((t: { plain_text: string }) => t.plain_text)
        .join("") ?? "(ไม่มีชื่อ)",
    date: props["วันที่"]?.date?.start ?? null,
    type,
    category: props["หมวดหมู่"]?.select?.name ?? "อื่นๆ",
    amount,
    netAmount,
    sharePerPerson: netAmount / 3,
    channel: props["ช่องทางชำระ"]?.select?.name ?? null,
    recordedBy: props["บันทึกโดย"]?.people?.[0]?.name ?? null,
    createdAt: page.created_time,
  };
}

// ---- GET /api/finance ----
// ?month=2025-05   → กรองตามเดือน (YYYY-MM)
// ?type=รายรับ     → กรองตามประเภท
// ?category=ยอดขาย → กรองตามหมวดหมู่

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const month    = searchParams.get("month");    // "2025-05"
    const type     = searchParams.get("type");
    const category = searchParams.get("category");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [];

    if (type)     filters.push({ property: "ประเภท",    select: { equals: type } });
    if (category) filters.push({ property: "หมวดหมู่",  select: { equals: category } });
    if (month) {
      const start = `${month}-01`;
      const end   = new Date(
        parseInt(month.split("-")[0]),
        parseInt(month.split("-")[1]),
        0
      ).toISOString().split("T")[0];
      filters.push({ property: "วันที่", date: { on_or_after: start } });
      filters.push({ property: "วันที่", date: { on_or_before: end } });
    }

    const response = await notion.databases.query({
      database_id: FINANCE_DB_ID,
      filter:
        filters.length === 0
          ? undefined
          : filters.length === 1
          ? filters[0]
          : { and: filters },
      sorts: [{ property: "วันที่", direction: "descending" }],
      page_size: 100,
    });

    const transactions = response.results.map(mapPageToTransaction);

    // คำนวณ summary
    const totalRevenue  = transactions.filter((t) => t.type === "รายรับ").reduce((s, t) => s + t.amount, 0);
    const totalExpense  = transactions.filter((t) => t.type === "รายจ่าย").reduce((s, t) => s + t.amount, 0);
    const netProfit     = totalRevenue - totalExpense;
    const sharePerPerson = netProfit / 3;

    return NextResponse.json(
      { transactions, summary: { totalRevenue, totalExpense, netProfit, sharePerPerson } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/finance]", err);
    return NextResponse.json({ error: "ดึงข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

// ---- POST /api/finance ----
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, date, type, category, amount, channel } = body;

    if (!title || !amount || !type) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      "วัน/รายการ": { title: [{ text: { content: title } }] },
      ประเภท:       { select: { name: type } },
      "จำนวนเงิน (บาท)": { number: amount },
    };

    if (date)     properties["วันที่"]       = { date: { start: date } };
    if (category) properties["หมวดหมู่"]     = { select: { name: category } };
    if (channel)  properties["ช่องทางชำระ"]  = { select: { name: channel } };

    const page = await notion.pages.create({
      parent: { database_id: FINANCE_DB_ID },
      properties,
    });

    return NextResponse.json({ transaction: mapPageToTransaction(page) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/finance]", err);
    return NextResponse.json({ error: "บันทึกรายการไม่สำเร็จ" }, { status: 500 });
  }
}
