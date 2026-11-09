/* เรียก Anthropic Messages API ฝั่งเซิร์ฟเวอร์ รองรับเครื่องมือค้นเว็บ (web search) */

export interface Source { url: string; title: string; age: string }

export class ClaudeError extends Error {
  constructor(message: string, public kind: "config" | "websearch" | "upstream") {
    super(message);
  }
}

export const MODEL = process.env.MARKETING_AI_MODEL ?? "claude-sonnet-4-6";

interface Opts { system: string; user: string; maxTokens?: number; webSearch?: { maxUses: number } }

export async function claude({ system, user, maxTokens = 3500, webSearch }: Opts): Promise<{ text: string; sources: Source[] }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClaudeError("ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์", "config");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: { role: "user" | "assistant"; content: any }[] = [{ role: "user", content: user }];
  const sources = new Map<string, Source>();
  let text = "";

  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages,
        ...(webSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: webSearch.maxUses, user_location: { type: "approximate", country: "TH", timezone: "Asia/Bangkok" } }] } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg: string = data?.error?.message ?? `HTTP ${res.status}`;
      console.error("[anthropic]", res.status, msg);
      throw new ClaudeError(msg, webSearch && /web.?search/i.test(msg) ? "websearch" : "upstream");
    }
    const blocks: Record<string, unknown>[] = Array.isArray(data.content) ? data.content : [];
    for (const b of blocks) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content as Record<string, unknown>[]) {
          if (r.type === "web_search_result" && typeof r.url === "string") {
            sources.set(r.url, { url: r.url, title: String(r.title ?? r.url).slice(0, 160), age: String(r.page_age ?? "") });
          }
        }
      }
    }
    text = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("");
    if (data.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: blocks }); continue; }
    break;
  }
  return { text, sources: [...sources.values()] };
}

export function extractJson(text: string): unknown {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (start < 0 || end < start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

const normUrl = (u: string) => u.replace(/#.*$/, "").replace(/[?&]utm_[^&]*/g, "").replace(/\/$/, "");
export function verifiedUrls(urls: unknown, sources: Source[]): Source[] {
  const byNorm = new Map(sources.map((s) => [normUrl(s.url), s]));
  const out: Source[] = [];
  for (const u of Array.isArray(urls) ? urls : []) {
    const hit = typeof u === "string" ? byNorm.get(normUrl(u)) : undefined;
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}
