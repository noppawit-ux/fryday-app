import { notion } from "@/lib/notion";

/* เก็บสคริปต์/โน้ตของแคมเปญเป็นเนื้อหาในหน้า Notion (ย่อหน้าละบรรทัด) */

const MAX = 1900; // Notion จำกัด 2000 ตัวอักษรต่อ rich text
const MAX_BLOCKS = 95;

export function toBlocks(text: string) {
  const out: { object: "block"; type: "paragraph"; paragraph: { rich_text: { type: "text"; text: { content: string } }[] } }[] = [];
  for (const line of text.split("\n")) {
    for (let i = 0; i < Math.max(1, line.length); i += MAX) {
      out.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: line ? [{ type: "text", text: { content: line.slice(i, i + MAX) } }] : [] },
      });
    }
  }
  return out.slice(0, MAX_BLOCKS);
}

export async function readNotes(pageId: string): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    for (const b of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blk = b as any;
      if (blk.type === "paragraph") {
        lines.push((blk.paragraph.rich_text as { plain_text: string }[]).map((t) => t.plain_text).join(""));
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return lines.join("\n");
}

export async function replaceNotes(pageId: string, text: string) {
  const res = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  for (const b of res.results) await notion.blocks.delete({ block_id: b.id });
  if (text.trim()) await notion.blocks.children.append({ block_id: pageId, children: toBlocks(text) });
}
