"use client";

import { useEffect, useMemo, useState } from "react";

interface Task { id: string; name: string; status: string; priority: string; deadline: string | null; assignee: string | null; done: boolean; }
interface Campaign { id: string; title: string; status: string; postDate: string | null; channels: string[]; }

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  รอดำเนินการ: { bg: "#FDE8E4", color: "#B3200A" },
  กำลังทำ: { bg: "#FFF0D6", color: "#8A5300" },
  เสร็จแล้ว: { bg: "#E3F1E6", color: "#1F5A2E" },
  ติดปัญหา: { bg: "#F7D4D4", color: "#7A1414" },
};
const PRIORITY_BAR: Record<string, string> = { ด่วนมาก: "#C0200A", ปานกลาง: "#E0A12B", ไม่เร่งด่วน: "#3C9A78" };
const DAY_LABEL = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayKey = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const shortDate = (iso: string | null) => (iso ? new Date(dayKey(iso) + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "–");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "อรุณสวัสดิ์" : h < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น"; };

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, mRes] = await Promise.all([fetch("/api/tasks?done=false"), fetch("/api/marketing")]);
        if (tRes.ok) setTasks((await tRes.json()).tasks ?? []);
        if (mRes.ok) setCampaigns((await mRes.json()).campaigns ?? []);
      } finally { setLoading(false); }
    })();
  }, []);

  const now = new Date();
  const todayKey = key(now);
  const overdue = tasks.filter((t) => t.deadline && dayKey(t.deadline) < todayKey);
  const posted = campaigns.filter((c) => c.status === "โพสต์แล้ว").length;
  const upcoming = campaigns.filter((c) => c.postDate && c.status !== "โพสต์แล้ว").sort((a, b) => dayKey(a.postDate).localeCompare(dayKey(b.postDate))).slice(0, 4);
  const recent = tasks.slice(0, 5);

  const week = useMemo(() => {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);
  const weekKeys = week.map(key);
  const weekItems = [
    ...tasks.filter((t) => weekKeys.includes(dayKey(t.deadline))).map((t) => ({ id: "t" + t.id, day: dayKey(t.deadline), title: t.name, kind: "งาน" })),
    ...campaigns.filter((c) => c.status !== "โพสต์แล้ว" && weekKeys.includes(dayKey(c.postDate))).map((c) => ({ id: "c" + c.id, day: dayKey(c.postDate), title: c.title, kind: "โพสต์" })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  const busy = new Set(weekItems.map((w) => w.day));

  const statusCounts = ["รอดำเนินการ", "กำลังทำ", "ติดปัญหา"].map((s) => ({ s, n: tasks.filter((t) => t.status === s).length }));
  const statusColor: Record<string, string> = { รอดำเนินการ: "#C0200A", กำลังทำ: "#E8895F", ติดปัญหา: "#6E1A12" };
  const overduePct = tasks.length ? Math.round((overdue.length / tasks.length) * 100) : 0;
  const postedPct = campaigns.length ? Math.round((posted / campaigns.length) * 100) : 0;
  const monthLabel = now.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const dateLabel = now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="hm">
      <style>{CSS}</style>

      <section className="hm-hero">
        <div className="hm-hero-top">
          <div>
            <h1>{greeting()} <em>ทีม Fryday</em></h1>
            <p>{dateLabel}</p>
          </div>
          <div className="hm-hero-stat" aria-label="สรุปวันนี้">
            <b>{loading ? "–" : tasks.length}</b><span>งานคงค้าง</span>
            <i aria-hidden />
            <b className={overdue.length ? "warn" : ""}>{loading ? "–" : overdue.length}</b><span>เกินกำหนด</span>
          </div>
        </div>
        <nav className="hm-pills" aria-label="ทางลัด">
          <a href="/tasks" className="primary">งานของร้าน</a>
          <a href="/marketing">Marketing</a>
          <a href="/calendar">ปฏิทิน</a>
          <a href="/files">ไฟล์งาน</a>
          <a href="https://fryday-accounting-dashboard.vercel.app" target="_blank" rel="noopener noreferrer">การเงิน ↗</a>
        </nav>
      </section>

      <section className="hm-cal" aria-label="สัปดาห์นี้">
        <div className="hm-cal-head"><h2>{monthLabel}</h2><a href="/calendar">เปิดปฏิทิน</a></div>
        <div className="hm-week">
          {week.map((d, i) => {
            const k = key(d);
            return (
              <div key={k} className={"hm-day" + (k === todayKey ? " today" : "")}>
                <span>{DAY_LABEL[i]}</span><b>{d.getDate()}</b><i className={busy.has(k) ? "on" : ""} />
              </div>
            );
          })}
        </div>
        <h3>กำหนดสัปดาห์นี้</h3>
        {weekItems.length === 0 ? <p className="hm-empty">ไม่มีงานหรือโพสต์ที่ครบกำหนดในสัปดาห์นี้</p> : (
          <ul className="hm-list">
            {weekItems.slice(0, 6).map((w) => (
              <li key={w.id}>
                <span className="hm-chip">{shortDate(w.day)}</span>
                <span className="hm-li-t">{w.title}</span>
                <span className="hm-kind">{w.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hm-stats">
        <article className="hm-card">
          <h3>งานคงค้าง</h3>
          <b className="hm-big">{loading ? "–" : tasks.length}</b>
          <div className="hm-seg" role="img" aria-label="สัดส่วนงานตามสถานะ">
            {tasks.length === 0 ? <span style={{ flex: 1, background: "#EADBD6" }} /> : statusCounts.filter((x) => x.n).map((x) => <span key={x.s} style={{ flex: x.n, background: statusColor[x.s] }} />)}
          </div>
          <p className="hm-legend">{statusCounts.map((x) => <span key={x.s}><i style={{ background: statusColor[x.s] }} />{x.s} {x.n}</span>)}</p>
        </article>
        <article className="hm-card tint">
          <h3>เกินกำหนด</h3>
          <div className="hm-impact">
            <div>
              <b className="hm-big">{loading ? "–" : overdue.length}</b>
              <p className="hm-sub">{overduePct}% ของงานคงค้าง</p>
            </div>
            <div className="hm-tube" aria-hidden><span style={{ height: `${Math.max(overduePct, 6)}%` }} /></div>
          </div>
        </article>
        <article className="hm-card">
          <h3>โพสต์แล้ว</h3>
          <b className="hm-big">{loading ? "–" : posted}<small> / {campaigns.length}</small></b>
          <div className="hm-bar" role="img" aria-label={`โพสต์แล้ว ${postedPct}%`}><span style={{ width: `${postedPct}%` }} /></div>
          <p className="hm-sub">{postedPct}% ของแคมเปญทั้งหมด</p>
        </article>
      </section>

      <section className="hm-card hm-tasks">
        <div className="hm-card-head"><h2>งานล่าสุด</h2><a href="/tasks">ดูทั้งหมด ({tasks.length})</a></div>
        {loading ? <p className="hm-empty">กำลังโหลด…</p> : recent.length === 0 ? <p className="hm-empty">ไม่มีงานค้างอยู่</p> : (
          <ul className="hm-rows">
            {recent.map((t) => {
              const late = !!t.deadline && dayKey(t.deadline) < todayKey;
              const tone = STATUS_TONE[t.status] ?? { bg: "#F1EDE8", color: "#6B6760" };
              return (
                <li key={t.id} style={{ borderLeftColor: PRIORITY_BAR[t.priority] ?? "#CFC8C2" }}>
                  <div className="hm-row-main">
                    <p>{t.name}</p>
                    <span className="hm-st" style={{ background: tone.bg, color: tone.color }}>{t.status}</span>
                  </div>
                  <span className={"hm-due" + (late ? " late" : "")}>{t.deadline ? (late ? "เกิน " : "") + shortDate(t.deadline) : "ไม่มีกำหนด"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="hm-card hm-mkt">
        <div className="hm-card-head"><h2>แผนโพสต์ที่รอ</h2><a href="/marketing">ดูทั้งหมด</a></div>
        {upcoming.length === 0 ? <p className="hm-empty">ยังไม่มีโพสต์ที่รอดำเนินการ</p> : (
          <ul className="hm-rows">
            {upcoming.map((c) => (
              <li key={c.id} style={{ borderLeftColor: "#C0200A" }}>
                <div className="hm-row-main"><p>{c.title}</p><span className="hm-st" style={{ background: "#FDE8E4", color: "#B3200A" }}>{c.status}</span></div>
                <span className="hm-due">{shortDate(c.postDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const CSS = `
body{background:#F7EFEA !important;-webkit-font-smoothing:antialiased}
.hm{--ink:#2A0B07;--red:#C0200A;--coral:#FF8A66;--blush:#FDE8E4;--line:#EBD9D2;--mute:#7A6A64;max-width:1080px;margin:0 auto;padding:20px 16px 56px;display:grid;gap:14px;grid-template-columns:repeat(12,1fr);color:var(--ink)}
.hm *{box-sizing:border-box}.hm h1,.hm h2,.hm h3,.hm p,.hm ul{margin:0}.hm ul{padding:0;list-style:none}
.hm a{text-decoration:none;color:inherit}.hm a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.hm-hero{grid-column:1/9;background:radial-gradient(120% 140% at 100% 0%,#8F1B0B 0%,#4A0F08 55%,#2A0B07 100%);color:#fff;border-radius:26px;padding:26px 26px 22px;display:flex;flex-direction:column;justify-content:space-between;gap:26px;min-height:200px}
.hm-hero-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
.hm-hero h1{font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-.01em}.hm-hero h1 em{font-style:normal;color:var(--coral)}
.hm-hero p{margin-top:6px;font-size:13px;color:rgba(255,255,255,.7)}
.hm-hero-stat{display:grid;grid-template-columns:auto auto;column-gap:10px;align-items:baseline;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:10px 16px}
.hm-hero-stat b{font-size:24px;font-variant-numeric:tabular-nums;text-align:right}.hm-hero-stat b.warn{color:#FFC27A}.hm-hero-stat span{font-size:12px;color:rgba(255,255,255,.72)}.hm-hero-stat i{grid-column:1/3;height:1px;background:rgba(255,255,255,.14);margin:6px 0}
.hm-pills{display:flex;gap:8px;flex-wrap:wrap}
.hm-pills a{font-size:13px;padding:9px 16px;border-radius:99px;border:1px solid rgba(255,255,255,.28);color:#fff;transition:background .15s}
.hm-pills a:hover{background:rgba(255,255,255,.12)}.hm-pills a.primary{background:var(--coral);border-color:var(--coral);color:#3A0D06;font-weight:600}.hm-pills a.primary:hover{background:#FF9C7C}
.hm-cal{grid-column:9/13;grid-row:1/3;background:#fff;border:1px solid var(--line);border-radius:26px;padding:20px}
.hm-cal-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}.hm-cal-head h2{font-size:17px;font-weight:600}.hm-cal-head a{font-size:12px;color:var(--red)}
.hm-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:18px}
.hm-day{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0 6px;border-radius:14px;font-size:11px;color:var(--mute)}
.hm-day b{font-size:15px;color:var(--ink);font-variant-numeric:tabular-nums}.hm-day i{width:5px;height:5px;border-radius:50%;background:transparent}.hm-day i.on{background:var(--red)}
.hm-day.today{background:var(--ink);color:rgba(255,255,255,.7)}.hm-day.today b{color:#fff}.hm-day.today i.on{background:var(--coral)}
.hm-cal h3{font-size:12px;color:var(--mute);font-weight:500;margin-bottom:10px}
.hm-list{display:flex;flex-direction:column;gap:8px}.hm-list li{display:flex;align-items:center;gap:8px;background:#FBF4F0;border-radius:12px;padding:9px 10px;font-size:13px}
.hm-chip{flex:none;font-size:11px;background:var(--ink);color:#fff;border-radius:99px;padding:3px 9px}.hm-li-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hm-kind{flex:none;font-size:11px;color:var(--red)}
.hm-empty{font-size:13px;color:var(--mute);padding:6px 0}
.hm-stats{grid-column:1/9;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.hm-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:18px}
.hm-card.tint{background:linear-gradient(160deg,#FFE3DA,#FBC9BB)}
.hm-card h3{font-size:13px;font-weight:500;color:var(--mute);margin-bottom:6px}
.hm-big{display:block;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.hm-big small{font-size:16px;color:var(--mute);font-weight:500}
.hm-seg{display:flex;gap:3px;height:10px;margin:14px 0 10px}.hm-seg span{border-radius:99px}
.hm-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--mute)}.hm-legend span{display:inline-flex;align-items:center;gap:5px}.hm-legend i{width:7px;height:7px;border-radius:50%}
.hm-sub{font-size:12px;color:var(--mute);margin-top:6px}
.hm-impact{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.hm-tube{width:30px;height:84px;background:rgba(255,255,255,.65);border-radius:99px;display:flex;align-items:flex-end;overflow:hidden}.hm-tube span{display:block;width:100%;border-radius:99px;background:linear-gradient(180deg,#E8452B,#9E1A0A)}
.hm-bar{height:10px;border-radius:99px;background:#F3E3DD;margin:14px 0 0;overflow:hidden}.hm-bar span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#E8452B,#C0200A)}
.hm-tasks{grid-column:1/8}.hm-mkt{grid-column:8/13}
.hm-card-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}.hm-card-head h2{font-size:16px;font-weight:600}.hm-card-head a{font-size:12px;color:var(--red)}
.hm-rows{display:flex;flex-direction:column;gap:8px}.hm-rows li{display:flex;justify-content:space-between;align-items:center;gap:10px;border-left:4px solid;background:#FBF4F0;border-radius:4px 14px 14px 4px;padding:10px 12px}
.hm-row-main{min-width:0;display:flex;flex-direction:column;gap:5px;align-items:flex-start}.hm-row-main p{font-size:13.5px;font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-st{font-size:11px;padding:2px 9px;border-radius:99px}.hm-due{flex:none;font-size:12px;color:var(--mute)}.hm-due.late{color:var(--red);font-weight:600}
@media (max-width:900px){.hm{grid-template-columns:1fr}.hm>*{grid-column:1 !important;grid-row:auto !important}.hm-stats{grid-template-columns:repeat(3,1fr)}}
@media (max-width:560px){.hm{padding:12px 12px 80px}.hm-hero{padding:20px 18px;border-radius:22px}.hm-hero h1{font-size:22px}.hm-stats{grid-template-columns:1fr 1fr}.hm-stats .hm-card:first-child{grid-column:1/-1}.hm-big{font-size:34px}}
`;
