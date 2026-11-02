// เรียก Supabase ด้วย service role key ฝั่งเซิร์ฟเวอร์เท่านั้น (ห้ามส่งคีย์นี้ไปที่เบราว์เซอร์)
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://razqsirgbwixjrbihaou.supabase.co";

export class RoadmapDbError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function sb<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new RoadmapDbError("SUPABASE_SERVICE_ROLE_KEY is not set", 500);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new RoadmapDbError(`Supabase ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export interface Phase {
  id: string;
  name: string;
  goal: string;
  area: Area;
  start_date: string;
  end_date: string;
  sort_order: number;
}

export interface Task {
  id: string;
  title: string;
  phase_id: string;
  area: Area;
  status: Status;
  due: string | null;
  note: string;
  sort_order: number;
}

export type Area = "system" | "sales" | "cost" | "people";
export type Status = "todo" | "doing" | "done";
export const AREAS: Area[] = ["system", "sales", "cost", "people"];
export const STATUSES: Status[] = ["todo", "doing", "done"];
