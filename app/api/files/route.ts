import { NextRequest, NextResponse } from "next/server";
import { notion } from "@/lib/notion";
import { v2 as cloudinary } from "cloudinary";

const FILES_DB_ID = "36448e396be880c99810ee005fe59338";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface FrydayFile {
  id: string;
  name: string;
  fileType: string;
  category: string;
  url: string;
  size: number;
  uploadedBy: string | null;
  date: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPageToFile(page: any): FrydayFile {
  const props = page.properties;
  return {
    id: page.id,
    name: props["ชื่อไฟล์"]?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "(ไม่มีชื่อ)",
    fileType: props["ประเภท"]?.select?.name ?? "อื่นๆ",
    category: props["หมวดหมู่"]?.select?.name ?? "ทั่วไป",
    url: props["URL"]?.url ?? "",
    size: props["ขนาดไฟล์ (KB)"]?.number ?? 0,
    uploadedBy: props["อัปโหลดโดย"]?.people?.[0]?.name ?? null,
    date: props["วันที่"]?.date?.start ?? null,
    createdAt: page.created_time,
  };
}

// ---- GET /api/files ----
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category");
    const fileType = searchParams.get("type");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [];
    if (category) filters.push({ property: "หมวดหมู่", select: { equals: category } });
    if (fileType) filters.push({ property: "ประเภท",   select: { equals: fileType } });

    const response = await notion.databases.query({
      database_id: FILES_DB_ID,
      filter: filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { and: filters },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 100,
    });

    const files = response.results.map(mapPageToFile);
    return NextResponse.json({ files, total: files.length }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/files]", err);
    return NextResponse.json({ error: "ดึงข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

// ---- POST /api/files ----
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File;
    const category = formData.get("category") as string ?? "ทั่วไป";

    if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });

    // แปลงเป็น Buffer
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // กำหนดประเภทไฟล์
    const mime = file.type;
    let fileType = "อื่นๆ";
    if (mime.startsWith("image/"))       fileType = "รูปภาพ";
    else if (mime.startsWith("video/"))  fileType = "วิดีโอ";
    else if (mime.includes("pdf") || mime.includes("word") || mime.includes("excel") || mime.includes("sheet") || mime.includes("document")) fileType = "เอกสาร";

    // อัปโหลดไป Cloudinary
    const uploadResult = await new Promise<{ secure_url: string; bytes: number }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "fryday", resource_type: "auto", public_id: `${Date.now()}_${file.name}` },
        (error, result) => {
          if (error || !result) reject(error);
          else resolve({ secure_url: result.secure_url, bytes: result.bytes });
        }
      ).end(buffer);
    });

    // บันทึก metadata ใน Notion
    const page = await notion.pages.create({
      parent: { database_id: FILES_DB_ID },
      properties: {
        "ชื่อไฟล์":        { title:  [{ text: { content: file.name } }] },
        "ประเภท":          { select: { name: fileType } },
        "หมวดหมู่":        { select: { name: category } },
        "URL":             { url: uploadResult.secure_url },
        "ขนาดไฟล์ (KB)":  { number: Math.round(uploadResult.bytes / 1024) },
        "วันที่":           { date: { start: new Date().toISOString().slice(0, 10) } },
      },
    });

    return NextResponse.json({ file: mapPageToFile(page) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/files]", err);
    return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ" }, { status: 500 });
  }
}