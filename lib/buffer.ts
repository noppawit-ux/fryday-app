// ดึงสถิติโพสต์จาก Buffer (GraphQL) — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
const ENDPOINT = "https://api.buffer.com";
export const SERVICES = ["facebook", "instagram", "tiktok"] as const;
const MAX_PAGES_PER_CHANNEL = 5; // 5 หน้า × 20 โพสต์ ต่อช่อง ต่อรอบ (โควตาฟรี 1,000 คำขอ/ช่อง/30 วัน)
const PAGE_SIZE = 20;
const STOP_AFTER_DAYS = 45; // โพสต์เก่ากว่านี้ไม่ต้องไล่ต่อ

export class BufferError extends Error {
  constructor(message: string, public status = 502, public retryAfter?: number) {
    super(message);
  }
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new BufferError("ยังไม่ได้ตั้ง BUFFER_API_KEY ใน Vercel", 500);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    const ra = Number(res.headers.get("Retry-After")) || undefined;
    throw new BufferError("Buffer จำกัดจำนวนคำขอ (429) รอแล้วลองใหม่", 429, ra);
  }
  const text = await res.text();
  let body: { data?: T; errors?: { message: string }[] } = {};
  try { body = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
  if (!res.ok || body.errors?.length) {
    const msg = body.errors?.map((e) => e.message).join("; ") || text.slice(0, 200);
    throw new BufferError(`Buffer ${res.status}: ${msg}`.slice(0, 300), res.status === 401 ? 401 : 502);
  }
  if (!body.data) throw new BufferError("Buffer ตอบกลับไม่มีข้อมูล");
  return body.data;
}

export interface BufferChannel { id: string; name: string; service: string }
export interface BufferPostStat {
  post_id: string; channel_id: string; service: string; channel_name: string | null;
  text: string | null; due_at: string | null; metrics: Record<string, number>; metrics_updated_at: string | null;
}

export async function listChannels(): Promise<BufferChannel[]> {
  const org = await gql<{ account: { organizations: { id: string }[] } }>(`query { account { organizations { id } } }`);
  const out: BufferChannel[] = [];
  for (const o of org.account.organizations ?? []) {
    const ch = await gql<{ channels: { id: string; name?: string; displayName?: string; service: string }[] }>(
      `query($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name displayName service } }`,
      { org: o.id },
    );
    for (const c of ch.channels ?? []) {
      const service = String(c.service).toLowerCase();
      if ((SERVICES as readonly string[]).includes(service)) out.push({ id: c.id, name: c.displayName || c.name || service, service });
    }
  }
  return out;
}

export async function organizationId(): Promise<string> {
  const org = await gql<{ account: { organizations: { id: string }[] } }>(`query { account { organizations { id } } }`);
  const id = org.account.organizations?.[0]?.id;
  if (!id) throw new BufferError("ไม่พบ organization ใน Buffer");
  return id;
}

export async function fetchSentPosts(orgId: string, channel: BufferChannel): Promise<BufferPostStat[]> {
  const q = `query($org: OrganizationId!, $ch: [ChannelId!], $after: String) {
    posts(first: ${PAGE_SIZE}, after: $after, input: { organizationId: $org, filter: { status: [sent], channelIds: $ch } }) {
      edges { node { id text dueAt channelId metricsUpdatedAt metrics { type name value unit } } }
      pageInfo { endCursor hasNextPage }
    }
  }`;
  type Node = { id: string; text?: string; dueAt?: string; channelId: string; metricsUpdatedAt?: string;
    metrics?: { type: string; name?: string; value: number | string | null }[] };
  const cutoff = Date.now() - STOP_AFTER_DAYS * 86400000;
  const out: BufferPostStat[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES_PER_CHANNEL; page++) {
    const d: { posts: { edges: { node: Node }[]; pageInfo: { endCursor?: string; hasNextPage: boolean } } } =
      await gql(q, { org: orgId, ch: [channel.id], after });
    let allOld = d.posts.edges.length > 0;
    for (const { node } of d.posts.edges) {
      const metrics: Record<string, number> = {};
      for (const m of node.metrics ?? []) {
        const v = typeof m.value === "string" ? Number(m.value) : m.value;
        if (typeof v === "number" && Number.isFinite(v)) metrics[m.type] = v; // ไม่มีค่า ≠ 0 → ไม่ใส่คีย์
      }
      if (!node.dueAt || new Date(node.dueAt).getTime() >= cutoff) allOld = false;
      out.push({
        post_id: node.id, channel_id: channel.id, service: channel.service, channel_name: channel.name,
        text: node.text ?? null, due_at: node.dueAt ?? null, metrics, metrics_updated_at: node.metricsUpdatedAt ?? null,
      });
    }
    if (allOld || !d.posts.pageInfo.hasNextPage) break;
    after = d.posts.pageInfo.endCursor ?? null;
    if (!after) break;
  }
  return out;
}
