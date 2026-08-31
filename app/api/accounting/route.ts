import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://razqsirgbwixjrbihaou.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

async function supabaseFetch(table: string, params: string = "") {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}${params}`,
    {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split("-");

    // ดึงจาก monthly_pl_summary
    const monthly = await supabaseFetch(
      "monthly_pl_summary",
      `?year=eq.${year}&month=eq.${parseInt(mon)}&select=*`
    );

    // ดึงจาก sales_daily_summary รายวันเดือนนี้
    const daily = await supabaseFetch(
      "sales_daily_summary",
      `?sale_date=gte.${month}-01&sale_date=lte.${month}-31&select=*&order=sale_date.asc`
    );

    // ดึง expenses เดือนนี้
    const expenses = await supabaseFetch(
      "expenses",
      `?expense_date=gte.${month}-01&expense_date=lte.${month}-31&select=*`
    );

    // คำนวณ summary
    const pl = monthly?.[0];
    const totalRevenue  = pl?.total_revenue  ?? daily.reduce((s: number, d: { total_sales?: number }) => s + (d.total_sales ?? 0), 0);
    const totalExpense  = pl?.total_expenses ?? expenses.reduce((s: number, e: { amount?: number }) => s + (e.amount ?? 0), 0);
    const netProfit     = pl?.net_profit     ?? (totalRevenue - totalExpense);
    const sharePerPerson = netProfit / 3;

    return NextResponse.json({
      summary: { totalRevenue, totalExpense, netProfit, sharePerPerson },
      daily,
      monthly: pl ?? null,
    });
  } catch (err) {
    console.error("[GET /api/accounting]", err);
    return NextResponse.json({ error: "ดึงข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}