-- สถิติรายวันของเพจแต่ละช่องทาง (อัปโหลดจากไฟล์ CSV หรือกรอกเอง) content_type = 'all' คือยอดรวม
create table if not exists public.page_metrics (
  channel text not null, day date not null, content_type text not null default 'all',
  views integer, viewers integer, follower_views integer,
  likes integer, comments integer, shares integer, saves integer,
  profile_visits integer, new_followers integer, interactions integer,
  updated_at timestamptz not null default now(),
  primary key (channel, day, content_type)
);
alter table public.page_metrics enable row level security;
