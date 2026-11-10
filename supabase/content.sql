-- ผลคอนเทนต์รายคลิป×ช่อง และตัวนับ "ลูกค้ารู้จักร้านจากไหน" (เข้าถึงผ่าน service role จากเซิร์ฟเวอร์เท่านั้น)
create table if not exists public.content_results (
  campaign_id text not null, channel text not null,
  views integer, likes integer, comments integer, shares integer, saves integer,
  profile_visits integer, new_followers integer, captured_on date,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, channel)
);
create table if not exists public.content_survey (
  week_start date primary key,
  tiktok integer not null default 0, instagram integer not null default 0,
  facebook integer not null default 0, youtube integer not null default 0,
  friend integer not null default 0, passby integer not null default 0, other integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.content_results enable row level security;
alter table public.content_survey enable row level security;
