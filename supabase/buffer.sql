-- Buffer: เก็บสถิติโพสต์ (Facebook / Instagram / TikTok) ไว้เกิน 30 วันที่ Buffer เก็บให้
-- รันครั้งเดียวใน Supabase SQL editor (project razqsirgbwixjrbihaou) ไม่ลบข้อมูลเดิม
create table if not exists public.buffer_post_stats (
  post_id            text not null,
  captured_on        date not null,           -- วันที่ดึง (เก็บเป็นประวัติรายวัน)
  channel_id         text not null,
  service            text not null,           -- facebook | instagram | tiktok
  channel_name       text,
  text               text,
  due_at             timestamptz,             -- เวลาที่โพสต์
  metrics            jsonb not null default '{}'::jsonb, -- {views:123, likes:4, ...} ไม่มีค่า = ไม่ใส่คีย์ (ไม่ใช่ 0)
  metrics_updated_at timestamptz,
  fetched_at         timestamptz not null default now(),
  primary key (post_id, captured_on)
);
create index if not exists buffer_post_stats_due_idx on public.buffer_post_stats(due_at desc);

create table if not exists public.buffer_sync_log (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  ok        boolean not null,
  posts     integer not null default 0,
  detail    text
);

alter table public.buffer_post_stats enable row level security;
alter table public.buffer_sync_log   enable row level security;
revoke all on public.buffer_post_stats from anon, authenticated;
revoke all on public.buffer_sync_log   from anon, authenticated;
