import { NextRequest, NextResponse } from "next/server";
import { notion } from "@/lib/notion";

const MARKETING_DB_ID = process.env.NOTION_MARKETING_DB_ID!;

export interface FrydayCampaign {
  id: string;
  title: string;
  contentType: string | null;
  channels: string[];
  status: string;
  postDate: string | null;
  budget: number;
  reach: number;
  engagement: number;
  salesIncrease: number;
  assignee: string | null;
  link: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPageToCampaign(page: any): FrydayCampaign {
  const props = page.properties;
  return {
    id: page.id,
    title:
      props["ชื่อแคมเปญ/โพสต์"]?.title
        ?.map((t: { plain_text: string }) => t.plain_text)
        .join("") ?? "(ไม่มีชื่อ)",
    contentType: props["ประเภท Content"]?.select?.name ?? null,
    channels: props["ช่องทาง"]?.multi_select?.map((s: { name: string }) => s.name) ?? [],
    status: props["สถานะ"]?.select?.name ?? "ไอเดีย",
    postDate: props["วันที่โพสต์"]?.date?.start ?? null,
    budget: props["งบประมาณ (บาท)"]?.number ?? 0,
    reach: props["Reach"]?.number ?? 0,
    engagement: props["Engagement"]?.number ?? 0,
    salesIncrease: props["ยอดขายที่เพิ่ม (บาท)"]?.number ?? 0,
    assignee: props["ผู้รับผิดชอบ"]?.people?.[0]?.name ?? null,
    link: props["Link โพสต์"]?.url ?? null,
    createdAt: page.created_time,
  };
}

// ---- GET /api/marketing ----
// ?status=โพสต์แล้ว
// ?channel=Facebook
// ?assignee=ชื่อ

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status   = searchParams.get("status");
    const assignee = searchParams.get("assignee");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [];

    if (status)   filters.push({ property: "สถานะ",          select: { equals: status } });
    if (assignee) filters.push({ property: "ผู้รับผิดชอบ",   people: { contains: assignee } });

    const response = await notion.databases.query({
      database_id: MARKETING_DB_ID,
      filter:
        filters.length === 0
          ? undefined
          : filters.length === 1
          ? filters[0]
          : { and: filters },
      sorts: [{ property: "วันที่โพสต์", direction: "descending" }],
      page_size: 100,
    });

    const campaigns = response.results.map(mapPageToCampaign);

    // summary
    const totalBudget      = campaigns.reduce((s, c) => s + c.budget, 0);
    const totalReach       = campaigns.reduce((s, c) => s + c.reach, 0);
    const totalEngagement  = campaigns.reduce((s, c) => s + c.engagement, 0);
    const totalSales       = campaigns.reduce((s, c) => s + c.salesIncrease, 0);
    const posted           = campaigns.filter((c) => c.status === "โพสต์แล้ว").length;

    return NextResponse.json(
      { campaigns, summary: { totalBudget, totalReach, totalEngagement, totalSales, posted, total: campaigns.length } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/marketing]", err);
    return NextResponse.json({ error: "ดึงข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

// ---- POST /api/marketing ----
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, contentType, channels, status, postDate, budget, assigneeId, link } = body;

    if (!title) return NextResponse.json({ error: "กรุณาระบุชื่อแคมเปญ" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      "ชื่อแคมเปญ/โพสต์": { title: [{ text: { content: title } }] },
      สถานะ: { select: { name: status ?? "ไอเดีย" } },
    };

    if (contentType) properties["ประเภท Content"]     = { select: { name: contentType } };
    if (channels?.length) properties["ช่องทาง"]       = { multi_select: channels.map((c: string) => ({ name: c })) };
    if (postDate)  properties["วันที่โพสต์"]           = { date: { start: postDate } };
    if (budget)    properties["งบประมาณ (บาท)"]       = { number: budget };
    if (link)      properties["Link โพสต์"]            = { url: link };
    if (assigneeId) properties["ผู้รับผิดชอบ"]        = { people: [{ id: assigneeId }] };

    const page = await notion.pages.create({
      parent: { database_id: MARKETING_DB_ID },
      properties,
    });

    return NextResponse.json({ campaign: mapPageToCampaign(page) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/marketing]", err);
    return NextResponse.json({ error: "สร้างแคมเปญไม่สำเร็จ" }, { status: 500 });
  }
}