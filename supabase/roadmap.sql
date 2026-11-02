-- Fryday Roadmap: tables + sales snapshot function
-- Run once in Supabase SQL editor (project razqsirgbwixjrbihaou). Read it first; nothing here deletes existing data.

create table if not exists public.roadmap_phases (
  id          text primary key,
  name        text not null,
  goal        text not null default '',
  area        text not null check (area in ('system','sales','cost','people')),
  start_date  date not null,
  end_date    date not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.roadmap_tasks (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  phase_id    text not null references public.roadmap_phases(id) on delete cascade,
  area        text not null check (area in ('system','sales','cost','people')),
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  due         date,
  note        text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists roadmap_tasks_phase_idx on public.roadmap_tasks(phase_id);

-- Same pattern as the other accounting tables: RLS on, no policies.
-- Only the server (service role key) can read or write; the public anon key cannot.
alter table public.roadmap_phases enable row level security;
alter table public.roadmap_tasks  enable row level security;
revoke all on public.roadmap_phases from anon, authenticated;
revoke all on public.roadmap_tasks  from anon, authenticated;

-- Read-only sales snapshot used by the Roadmap page (same query as the Claude artifact).
create or replace function public.roadmap_snapshot()
returns json
language sql
stable
set search_path = public
as $$
with mx as (select max(sale_date) as d from sales_daily_summary), weekly as (select date_trunc('week', s.sale_date)::date as week_start, sum(s.total_received) as total, count(*) filter (where s.total_received > 0) as open_days, count(*) as rows from sales_daily_summary s cross join mx where s.sale_date >= date_trunc('week', mx.d)::date - 77 group by 1), daily as (select s.sale_date, s.total_received from sales_daily_summary s cross join mx where s.sale_date > mx.d - 14), dow as (select extract(isodow from s.sale_date)::int as dow, round(avg(s.total_received)) as avg_total, count(*) as days from sales_daily_summary s cross join mx where s.sale_date > mx.d - 84 and s.total_received > 0 group by 1), hourly as (select h.hour_of_day as hr, sum(h.amount) as total, count(distinct h.sale_date) as days from sales_hourly_breakdown h cross join mx where h.sale_date > mx.d - 28 group by 1), menus as (select m.menu_item_name as name, max(m.category) as category, sum(m.quantity_sold) as qty, sum(m.revenue) as revenue, max(i.price) as price, max(i.cost) as cost from menu_item_daily_sales m left join menu_items i on i.name = m.menu_item_name cross join mx where m.sale_date > mx.d - 28 group by 1 order by 4 desc limit 10), monthly as (select month, gross_revenue, net_revenue, total_expense, net_profit, profit_margin_pct from monthly_pl_summary order by month desc limit 6), chw as (select date_trunc('week', m.sale_date)::date as week_start, coalesce(sum(m.revenue) filter (where m.menu_item_name ~* 'delivery'), 0) as delivery, coalesce(sum(m.revenue) filter (where m.menu_item_name !~* 'delivery'), 0) as store from menu_item_daily_sales m cross join mx where m.sale_date >= date_trunc('week', mx.d)::date - 77 group by 1), plat as (select p.platform, count(*) filter (where p.sale_date > mx.d - 28) as days28, coalesce(sum(p.gross_sales) filter (where p.sale_date > mx.d - 28), 0) as gross28, coalesce(sum(p.gp_amount) filter (where p.sale_date > mx.d - 28), 0) as gp28, max(p.sale_date) as last_day from delivery_platform_sales p cross join mx group by 1), gps as (select platform, gp_percent from delivery_gp_settings), topc as (select case when m.menu_item_name ~* 'delivery' then 'delivery' else 'store' end as ch, m.menu_item_name as name, sum(m.quantity_sold) as qty, sum(m.revenue) as revenue, row_number() over (partition by case when m.menu_item_name ~* 'delivery' then 'delivery' else 'store' end order by sum(m.revenue) desc) as rn from menu_item_daily_sales m cross join mx where m.sale_date > mx.d - 28 group by 1, 2) select json_build_object(
  'asOf', (select d from mx), 'weekly', (select coalesce(json_agg(w order by w.week_start), '[]'::json) from weekly w), 'daily', (select coalesce(json_agg(x order by x.sale_date), '[]'::json) from daily x), 'dow', (select coalesce(json_agg(x order by x.dow), '[]'::json) from dow x), 'hourly', (select coalesce(json_agg(x order by x.hr), '[]'::json) from hourly x), 'menus', (select coalesce(json_agg(x), '[]'::json) from (select * from menus order by revenue desc) x), 'monthly', (select coalesce(json_agg(x order by x.month), '[]'::json) from monthly x), 'channelWeekly', (select coalesce(json_agg(x order by x.week_start), '[]'::json) from chw x), 'platforms', (select coalesce(json_agg(x), '[]'::json) from plat x), 'gpSettings', (select coalesce(json_agg(x), '[]'::json) from gps x), 'topByChannel', (select coalesce(json_agg(x order by x.ch, x.rn), '[]'::json) from topc x where x.rn <= 5), 'costCoverage', (select json_build_object('withCost', count(*) filter (where cost is not null and cost > 0), 'total', count(*)) from menu_items where is_active), 'zeroDays28', (select count(*) from sales_daily_summary s cross join mx where s.sale_date > mx.d - 28 and s.total_received = 0), 'rows28', (select count(*) from sales_daily_summary s cross join mx where s.sale_date > mx.d - 28), 'billZeroDays14', (select count(*) from sales_daily_summary s cross join mx where s.sale_date > mx.d - 14 and s.total_received > 0 and s.bill_count = 0));
$$;
revoke execute on function public.roadmap_snapshot() from public, anon, authenticated;
grant  execute on function public.roadmap_snapshot() to service_role;

-- Starting plan (same as the Claude artifact). Safe to re-run.
insert into public.roadmap_phases (id, name, goal, area, start_date, end_date, sort_order) values
  ('p1', 'เฟส 1 · ระบบ', 'ทุกบิลและทุกรายจ่ายเข้าที่เดียว โดยไม่ต้องจดซ้ำ', 'system', '2026-11-02', '2026-11-29', 1),
  ('p2', 'เฟส 2 · ยอดขาย', 'รู้ว่าขายอะไร เวลาไหน ใครซื้อ', 'sales', '2026-11-16', '2026-12-27', 2),
  ('p3', 'เฟส 3 · ต้นทุน', 'รู้กำไรต่อเมนูและหาจุดรั่ว', 'cost', '2026-11-30', '2027-01-10', 3),
  ('p4', 'เฟส 4 · คน', 'ร้านเดินได้เมื่อเจ้าของไม่อยู่ร้าน', 'people', '2026-12-21', '2027-02-14', 4)
on conflict (id) do nothing;

insert into public.roadmap_tasks (id, title, phase_id, area, status, due, note, sort_order) values
  ('t01', 'เชื่อมระบบสั่งอาหารกับบัญชี ให้ยอดขายไหลเข้าอัตโนมัติ', 'p1', 'system', 'todo', '2026-11-15', '', 1),
  ('t02', 'ทำฟอร์มบันทึกรายจ่ายที่กรอกจากมือถือได้ภายใน 30 วินาที', 'p1', 'system', 'todo', '2026-11-18', '', 2),
  ('t03', 'ทำเช็กลิสต์ปิดยอดรายวัน 1 หน้า', 'p1', 'system', 'todo', '2026-11-22', '', 3),
  ('t04', 'ทดลองปิดยอดต่อเนื่อง 7 วัน แล้วปรับขั้นตอน', 'p1', 'system', 'todo', '2026-11-29', '', 4),
  ('t05', 'ทำรายงานยอดขายตามเมนู ช่วงเวลา และวัน', 'p2', 'sales', 'todo', '2026-12-06', '', 5),
  ('t06', 'จัดกลุ่มเมนู ขายดี/ไม่ดี คู่กับกำไรสูง/ต่ำ', 'p2', 'sales', 'todo', '2026-12-13', '', 6),
  ('t07', 'เลือกกลยุทธ์ 1-2 อย่างไปทดลอง เช่น เมนูเซ็ต โปรช่วงเวลาเงียบ', 'p2', 'sales', 'todo', '2026-12-20', '', 7),
  ('t08', 'ทำแพ็กเกจนั่งห้องแอร์ + เล่นบอร์ดเกม', 'p2', 'sales', 'todo', '2026-12-20', '', 8),
  ('t09', 'วัดผลการตลาดด้วยยอดขายจริง ไม่ใช่แค่ยอดไลก์', 'p2', 'sales', 'todo', '2026-12-27', '', 9),
  ('t10', 'คำนวณต้นทุนต่อเมนู เริ่มจากเมนูขายดี 5-10 อันดับแรก', 'p3', 'cost', 'todo', '2026-12-13', '', 10),
  ('t11', 'ปรับราคาหรือสูตรของเมนูที่กำไรบาง', 'p3', 'cost', 'todo', '2026-12-27', '', 11),
  ('t12', 'เลือกซัพพลายเออร์หลัก เทียบราคา และกำหนดจุดสั่งซ้ำ', 'p3', 'cost', 'todo', '2027-01-03', '', 12),
  ('t13', 'บันทึกของเสียรายสัปดาห์', 'p3', 'cost', 'todo', '2027-01-10', '', 13),
  ('t14', 'ทำ SOP จากงานที่ทำซ้ำ (ปิดยอด รับออเดอร์ ขั้นตอนทอด)', 'p4', 'people', 'todo', '2027-01-10', '', 14),
  ('t15', 'ทำสูตรมาตรฐานของเมนูหลัก ให้รสชาติเท่ากันทุกกะ', 'p4', 'people', 'todo', '2027-01-24', '', 15),
  ('t16', 'ฝึกหัวหน้ากะ 1 คน ให้ปิดยอดและสั่งของได้', 'p4', 'people', 'todo', '2027-02-07', '', 16),
  ('t17', 'กำหนดความรับผิดชอบและเช็กลิสต์ต่อกะ', 'p4', 'people', 'todo', '2027-02-14', '', 17)
on conflict (id) do nothing;
