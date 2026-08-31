import { NextRequest, NextResponse } from "next/server";
import { notion } from "@/lib/notion";

// ---- Config ----
const LINE_TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const TARGET_IDS   = (process.env.LINE_NOTIFY_TARGET_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TASKS_DB_ID  = process.env.NOTION_TASKS_DB_ID!;
const EVENTS_DB_ID = process.env.NOTION_EVENTS_DB_ID ?? "";
const ACCOUNTING_URL = process.env.DASHBOARD_REVIEW_URL ?? "https://fryday-accounting-dashboard.vercel.app";

// ---- ส่ง Line Message ----
async function sendLineMessage(userId: string, messages: object[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
  const data = await res.json();
  console.log(`[LINE] to=${userId} status=${res.status}`, JSON.stringify(data));
  return data;
}

// ---- ดึง Tasks ที่ยังค้างอยู่และ Deadline วันนี้/เกินกำหนด ----
async function fetchTasksSummary() {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const res = await notion.databases.query({
    database_id: TASKS_DB_ID,
    filter: {
      and: [
        { property: "เสร็จแล้ว?", checkbox: { equals: false } },
      ],
    },
    sorts: [{ property: "Deadline", direction: "ascending" }],
    page_size: 50,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = res.results.map((p: any) => ({
    name: p.properties["ชื่องาน"]?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "(ไม่มีชื่อ)",
    status: p.properties["สถานะ"]?.select?.name ?? "รอดำเนินการ",
    priority: p.properties["ความสำคัญ"]?.select?.name ?? "ปานกลาง",
    deadline: p.properties["Deadline"]?.date?.start ?? null,
    assignee: p.properties["ผู้รับผิดชอบ"]?.people?.[0]?.name ?? null,
  }));

  const overdue   = tasks.filter((t) => t.deadline && t.deadline < today);
  const dueToday  = tasks.filter((t) => t.deadline === today);
  const dueTomorrow = tasks.filter((t) => t.deadline === tomorrow);
  const urgent    = tasks.filter((t) => t.priority === "ด่วนมาก" && !t.deadline);

  return { tasks, overdue, dueToday, dueTomorrow, urgent };
}

// ---- ดึง Events วันนี้และพรุ่งนี้ ----
async function fetchEventsSummary() {
  if (!EVENTS_DB_ID) return { today: [], tomorrow: [] };
  const today    = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const res = await notion.databases.query({
    database_id: EVENTS_DB_ID,
    filter: {
      or: [
        { property: "วันเวลา", date: { equals: today } },
        { property: "วันเวลา", date: { equals: tomorrow } },
      ],
    },
    sorts: [{ property: "วันเวลา", direction: "ascending" }],
    page_size: 20,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = res.results.map((p: any) => ({
    name: p.properties["ชื่อกิจกรรม"]?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "(ไม่มีชื่อ)",
    date: p.properties["วันเวลา"]?.date?.start ?? null,
    type: p.properties["ประเภท"]?.select?.name ?? "ทั่วไป",
  }));

  return {
    today:    events.filter((e) => e.date?.startsWith(today)),
    tomorrow: events.filter((e) => e.date?.startsWith(tomorrow)),
  };
}

// ---- ดึงยอดขายจาก fryday-accounting ----
async function fetchAccountingSummary() {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const res = await fetch(`${ACCOUNTING_URL}/api/summary?month=${month}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- สร้าง Flex Message สวยงาม ----
function buildFlexMessage(
  taskData: Awaited<ReturnType<typeof fetchTasksSummary>>,
  eventData: Awaited<ReturnType<typeof fetchEventsSummary>>,
  accounting: Record<string, number> | null,
) {
  const thDate = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // สร้าง body contents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    // Header วันที่
    {
      type: "box", layout: "vertical",
      backgroundColor: "#C0200A", paddingAll: "16px",
      contents: [
        { type: "text", text: "🍗 Fryday Daily Brief", color: "#FFFFFF", size: "lg", weight: "bold" },
        { type: "text", text: thDate, color: "#FFCCCC", size: "sm", margin: "sm" },
      ],
    },
    // Divider
    { type: "separator" },
  ];

  // ---- งานด่วน / เกิน Deadline ----
  if (taskData.overdue.length > 0 || taskData.dueToday.length > 0) {
    contents.push({
      type: "box", layout: "vertical", margin: "md", paddingAll: "12px",
      backgroundColor: "#FFF5F5", cornerRadius: "8px",
      contents: [
        { type: "text", text: "⚠️ งานที่ต้องดำเนินการ", weight: "bold", color: "#C0200A", size: "sm" },
        ...(taskData.overdue.slice(0, 3).map((t) => ({
          type: "box", layout: "horizontal", margin: "sm",
          contents: [
            { type: "text", text: "🔴", size: "sm", flex: 0 },
            { type: "text", text: `${t.name}`, size: "sm", color: "#333", flex: 1, margin: "sm", wrap: true },
            { type: "text", text: "เกิน!", size: "xs", color: "#C0200A", flex: 0 },
          ],
        }))),
        ...(taskData.dueToday.slice(0, 3).map((t) => ({
          type: "box", layout: "horizontal", margin: "sm",
          contents: [
            { type: "text", text: "🟡", size: "sm", flex: 0 },
            { type: "text", text: `${t.name}`, size: "sm", color: "#333", flex: 1, margin: "sm", wrap: true },
            { type: "text", text: "วันนี้", size: "xs", color: "#854F0B", flex: 0 },
          ],
        }))),
      ],
    });
  }

  // ---- สรุปงานทั้งหมด ----
  contents.push({
    type: "box", layout: "horizontal", margin: "md", paddingAll: "10px",
    backgroundColor: "#FFF0EE", cornerRadius: "8px",
    contents: [
      { type: "box", layout: "vertical", flex: 1, contents: [
        { type: "text", text: String(taskData.tasks.length), size: "xxl", weight: "bold", color: "#C0200A", align: "center" },
        { type: "text", text: "งานคงค้าง", size: "xs", color: "#666", align: "center" },
      ]},
      { type: "separator" },
      { type: "box", layout: "vertical", flex: 1, contents: [
        { type: "text", text: String(taskData.overdue.length), size: "xxl", weight: "bold", color: taskData.overdue.length > 0 ? "#C0200A" : "#1D9E75", align: "center" },
        { type: "text", text: "เกิน Deadline", size: "xs", color: "#666", align: "center" },
      ]},
      { type: "separator" },
      { type: "box", layout: "vertical", flex: 1, contents: [
        { type: "text", text: String(taskData.dueToday.length), size: "xxl", weight: "bold", color: "#854F0B", align: "center" },
        { type: "text", text: "ครบวันนี้", size: "xs", color: "#666", align: "center" },
      ]},
    ],
  });

  // ---- กิจกรรมวันนี้ ----
  if (eventData.today.length > 0) {
    contents.push({ type: "separator", margin: "md" });
    contents.push({
      type: "box", layout: "vertical", margin: "md", paddingAll: "12px",
      backgroundColor: "#F0EDFF", cornerRadius: "8px",
      contents: [
        { type: "text", text: "🗓 กิจกรรมวันนี้", weight: "bold", color: "#3C3489", size: "sm" },
        ...eventData.today.map((e) => ({
          type: "box", layout: "horizontal", margin: "sm",
          contents: [
            { type: "text", text: "📌", size: "sm", flex: 0 },
            { type: "text", text: e.name, size: "sm", color: "#333", flex: 1, margin: "sm", wrap: true },
          ],
        })),
      ],
    });
  }

  // ---- กิจกรรมพรุ่งนี้ ----
  if (eventData.tomorrow.length > 0) {
    contents.push({
      type: "box", layout: "vertical", margin: "sm", paddingAll: "10px",
      backgroundColor: "#F5F5FF", cornerRadius: "8px",
      contents: [
        { type: "text", text: "📅 พรุ่งนี้", weight: "bold", color: "#534AB7", size: "sm" },
        ...eventData.tomorrow.map((e) => ({
          type: "box", layout: "horizontal", margin: "sm",
          contents: [
            { type: "text", text: "•", size: "sm", flex: 0, color: "#534AB7" },
            { type: "text", text: e.name, size: "sm", color: "#555", flex: 1, margin: "sm", wrap: true },
          ],
        })),
      ],
    });
  }

  // ---- ยอดขายจาก accounting ----
  if (accounting) {
    contents.push({ type: "separator", margin: "md" });
    contents.push({
      type: "box", layout: "vertical", margin: "md", paddingAll: "12px",
      backgroundColor: "#F0FFF4", cornerRadius: "8px",
      contents: [
        { type: "text", text: "💰 ยอดขายเดือนนี้", weight: "bold", color: "#27500A", size: "sm" },
        { type: "box", layout: "horizontal", margin: "sm", contents: [
          { type: "text", text: "รายรับ", size: "sm", color: "#555", flex: 1 },
          { type: "text", text: `฿${new Intl.NumberFormat("th-TH").format(accounting.totalRevenue ?? 0)}`, size: "sm", color: "#27500A", weight: "bold" },
        ]},
        { type: "box", layout: "horizontal", margin: "xs", contents: [
          { type: "text", text: "กำไรสุทธิ", size: "sm", color: "#555", flex: 1 },
          { type: "text", text: `฿${new Intl.NumberFormat("th-TH").format(accounting.netProfit ?? 0)}`, size: "sm", color: (accounting.netProfit ?? 0) >= 0 ? "#27500A" : "#C0200A", weight: "bold" },
        ]},
        { type: "box", layout: "horizontal", margin: "xs", contents: [
          { type: "text", text: "ส่วนแบ่ง/คน", size: "sm", color: "#555", flex: 1 },
          { type: "text", text: `฿${new Intl.NumberFormat("th-TH").format((accounting.netProfit ?? 0) / 3)}`, size: "sm", color: "#185FA5", weight: "bold" },
        ]},
      ],
    });
  }

  // ---- Footer ปุ่มเปิด App ----
  contents.push({ type: "separator", margin: "md" });
  contents.push({
    type: "box", layout: "horizontal", margin: "md", spacing: "sm",
    contents: [
      {
        type: "button", style: "primary", color: "#C0200A", height: "sm",
        action: { type: "uri", label: "เปิด Fryday", uri: "https://fryday-app-oawz-nllpai1cu-noppawit-uxs-projects.vercel.app" },
      },
      {
        type: "button", style: "secondary", height: "sm",
        action: { type: "uri", label: "ดูการเงิน", uri: "https://fryday-accounting-dashboard.vercel.app" },
      },
    ],
  });

  return {
    type: "flex",
    altText: `🍗 Fryday Daily Brief — งานคงค้าง ${taskData.tasks.length} รายการ`,
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", paddingAll: "0px", contents },
    },
  };
}

// ---- GET /api/notify — trigger ด้วย cron หรือเรียกตรง ----
// ใส่ secret query param เพื่อป้องกัน unauthorized call
// เช่น GET /api/notify?secret=YOUR_SECRET

export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== process.env.NOTIFY_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ดึงข้อมูลทั้งหมดพร้อมกัน
    const [taskData, eventData, accounting] = await Promise.all([
      fetchTasksSummary(),
      fetchEventsSummary(),
      fetchAccountingSummary(),
    ]);

    const flexMsg = buildFlexMessage(taskData, eventData, accounting);

    // ส่งให้ทุก Target ID
    await Promise.all(TARGET_IDS.map((uid) => sendLineMessage(uid, [flexMsg])));

    return NextResponse.json({
      success: true,
      sent_to: TARGET_IDS.length,
      tasks: taskData.tasks.length,
      overdue: taskData.overdue.length,
      dueToday: taskData.dueToday.length,
      events_today: eventData.today.length,
      has_accounting: accounting !== null,
    });
  } catch (err) {
    console.error("[GET /api/notify]", err);
    return NextResponse.json({ error: "ส่งแจ้งเตือนไม่สำเร็จ" }, { status: 500 });
  }
}

// POST สำหรับ Vercel Cron
export async function POST(req: NextRequest) {
  return GET(req);
}
