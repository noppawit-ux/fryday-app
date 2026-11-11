"use client";

import type { CSSProperties } from "react";
import {
  DOW, PLAT, baht, chanStats, dataNotes, fmtDate, hrLabel, kfmt, monthLabel, num, snapStats, type Snapshot,
} from "@/lib/roadmap-sales";

const RED = "#C0200A", BLUE = "#2A0B07", MUTED = "#7A6A64", LINE = "#EBD9D2";
const card: CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 22, padding: 18 };
const h3: CSSProperties = { fontSize: 14, fontWeight: 600, margin: "18px 0 6px" };
const th: CSSProperties = { fontSize: 12, color: MUTED, fontWeight: 500, textAlign: "left", padding: "6px 8px" };
const td: CSSProperties = { padding: "6px 8px", borderTop: `1px solid #F3E3DD`, fontSize: 13.5, verticalAlign: "top" };
const r: CSSProperties = { textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

function Stat({ k, v, d }: { k: string; v: string; d?: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 170px", background: "#FBF4F0", border: `1px solid ${LINE}`, borderRadius: 16, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: MUTED }}>{k}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{v}</div>
      {d && <div style={{ fontSize: 12, color: MUTED }}>{d}</div>}
    </div>
  );
}

const Delta = ({ v }: { v: number | null }) =>
  v == null ? null : <span style={{ color: v >= 0 ? "#2E8B6A" : RED, marginLeft: 4 }}>{v >= 0 ? "+" : ""}{v}%</span>;

function ChannelChart({ weeks }: { weeks: { week_start: string; delivery: number; store: number }[] }) {
  const W = 720, H = 220, L = 44, R = 8, T = 16, B = 28, pw = W - L - R, ph = H - T - B;
  const max = Math.max(1, ...weeks.map((w) => num(w.delivery) + num(w.store)));
  const step = [1000, 2000, 2500, 5000, 10000, 20000, 50000].find((x) => max / x <= 5) ?? 50000;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + ph - (v / top) * ph;
  const bw = pw / Math.max(weeks.length, 1);
  const grid: number[] = [];
  for (let v = 0; v <= top; v += step) grid.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, display: "block" }} role="img" aria-label="ยอดขายรายสัปดาห์แยกหน้าร้านและเดลิเวอรี">
      {grid.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={LINE} />
          <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill={MUTED}>{kfmt(v)}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const st = num(w.store), dl = num(w.delivery), bwid = bw * 0.62, x = L + i * bw + (bw - bwid) / 2;
        return (
          <g key={w.week_start}>
            <rect x={x} y={y(st)} width={bwid} height={Math.max(0, y(0) - y(st))} fill={RED}><title>{`${fmtDate(w.week_start)} หน้าร้าน ${baht(st)}`}</title></rect>
            <rect x={x} y={y(st + dl)} width={bwid} height={Math.max(0, y(st) - y(st + dl))} fill={BLUE}><title>{`${fmtDate(w.week_start)} เดลิเวอรี ${baht(dl)}`}</title></rect>
            <text x={x + bwid / 2} y={H - 10} textAnchor="middle" fontSize={10} fill={MUTED}>{fmtDate(w.week_start)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Bars({ rows, hot }: { rows: { label: string; v: number; key: string }[]; hot: Set<string> }) {
  const max = Math.max(1, ...rows.map((x) => x.v));
  return (
    <div>
      {rows.map((x) => (
        <div key={x.key} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 52px", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0" }}>
          <span style={{ fontWeight: hot.has(x.key) ? 600 : 400 }}>{x.label}</span>
          <span style={{ height: 10, background: "#F3E3DD", borderRadius: 99, overflow: "hidden" }}>
            <i style={{ display: "block", height: "100%", width: `${Math.round((x.v / max) * 100)}%`, background: RED, borderRadius: 99 }} />
          </span>
          <span style={{ textAlign: "right", color: MUTED }}>{kfmt(x.v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function SalesPanel({ snap, fetchedAt, onRefresh, busy }: { snap: Snapshot; fetchedAt: number; onRefresh: () => void; busy: boolean }) {
  const st = snapStats(snap), cs = chanStats(snap), notes = dataNotes(snap);
  const when = new Date(fetchedAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const topMenus = (ch: "store" | "delivery") => (snap.topByChannel ?? []).filter((m) => m.ch === ch);
  const mTable = (ch: "store" | "delivery") => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr><th style={th}>เมนู</th><th style={{ ...th, ...r }}>จาน</th><th style={{ ...th, ...r }}>รายได้</th></tr></thead>
      <tbody>{topMenus(ch).map((m) => (<tr key={m.name}><td style={{ ...td, overflowWrap: "anywhere" }}>{m.name}</td><td style={{ ...td, ...r }}>{num(m.qty)}</td><td style={{ ...td, ...r }}>{baht(m.revenue)}</td></tr>))}</tbody>
    </table>
  );
  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>ตัวเลขจริงจากระบบบัญชี</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>ข้อมูลถึง {fmtDate(snap.asOf)} · ดึงเมื่อ {when}</p>
        </div>
        <button onClick={onRefresh} disabled={busy} style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${LINE}`, background: "#fff", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "กำลังดึง…" : "รีเฟรชยอด"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <Stat k="7 วันล่าสุด" v={baht(st.t7)} d={<>เทียบ 7 วันก่อนหน้า {baht(st.p7)}<Delta v={st.delta} /></>} />
        <Stat k="เฉลี่ยต่อวันที่มียอดขาย" v={baht(st.avgOpen)} d={`จาก ${snap.weekly.length} สัปดาห์ล่าสุด`} />
        <Stat k="เมนูที่มีต้นทุนในระบบ" v={`${snap.costCoverage.withCost}/${snap.costCoverage.total}`} d="ของเมนูที่เปิดขาย" />
      </div>

      {cs && (
        <>
          <h3 style={h3}>เดลิเวอรี vs หน้าร้าน</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Stat k="หน้าร้าน (4 สัปดาห์ล่าสุด)" v={baht(cs.last4.s)} d={<>ก่อนหน้า {baht(cs.prev4.s)}<Delta v={cs.prev4.s > 0 ? Math.round(((cs.last4.s - cs.prev4.s) / cs.prev4.s) * 100) : null} /></>} />
            <Stat k="เดลิเวอรี (4 สัปดาห์ล่าสุด)" v={baht(cs.last4.d)} d={<>ก่อนหน้า {baht(cs.prev4.d)}<Delta v={cs.prev4.d > 0 ? Math.round(((cs.last4.d - cs.prev4.d) / cs.prev4.d) * 100) : null} /></>} />
            <Stat k="สัดส่วนเดลิเวอรี" v={cs.last4.share == null ? "-" : cs.last4.share + "%"} d={cs.prev4.share == null ? undefined : `4 สัปดาห์ก่อน ${cs.prev4.share}%`} />
          </div>
          <div style={{ overflowX: "auto", marginTop: 8 }}><ChannelChart weeks={cs.weeks.slice(-12)} /></div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: MUTED }}>
            <span><i style={{ display: "inline-block", width: 10, height: 10, background: RED, borderRadius: 3, marginRight: 6 }} />หน้าร้าน</span>
            <span><i style={{ display: "inline-block", width: 10, height: 10, background: BLUE, borderRadius: 3, marginRight: 6 }} />เดลิเวอรี</span>
          </div>
          <p style={{ fontSize: 12, color: MUTED, margin: "4px 0 0" }}>แยกจากชื่อเมนูที่มีคำว่า Delivery เพราะช่องแยกช่องทางในสรุปยอดรายวันยังว่างทั้งหมด สัปดาห์ล่าสุดยังไม่ครบ</p>

          {snap.platforms?.length > 0 && (
            <>
              <h3 style={h3}>แพลตฟอร์มเดลิเวอรี (28 วันล่าสุด)</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead><tr><th style={th}>แพลตฟอร์ม</th><th style={{ ...th, ...r }}>ยอดขาย</th><th style={{ ...th, ...r }}>GP จริง</th><th style={{ ...th, ...r }}>GP ที่ตั้งไว้</th><th style={th}>ข้อมูลล่าสุด</th></tr></thead>
                  <tbody>
                    {snap.platforms.map((x) => (
                      <tr key={x.platform}>
                        <td style={td}>{PLAT[x.platform] ?? x.platform}</td>
                        <td style={{ ...td, ...r }}>{baht(x.gross28)}</td>
                        <td style={{ ...td, ...r }}>{num(x.gross28) > 0 ? Math.round((num(x.gp28) / num(x.gross28)) * 100) + "%" : "-"}</td>
                        <td style={{ ...td, ...r }}>{cs.gps[x.platform] != null ? cs.gps[x.platform] + "%" : "-"}</td>
                        <td style={td}>{new Date(snap.asOf).getTime() - new Date(x.last_day).getTime() > 7 * 86400000 ? <b style={{ color: "#8A5300" }}>ข้อมูลหยุดที่ {fmtDate(x.last_day)}</b> : `ถึง ${fmtDate(x.last_day)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
            <div><h3 style={h3}>เมนูขายดีหน้าร้าน</h3>{mTable("store")}</div>
            <div><h3 style={h3}>เมนูขายดีเดลิเวอรี</h3>{mTable("delivery")}</div>
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
        <div>
          <h3 style={h3}>ยอดขายตามชั่วโมง (รวม 28 วัน)</h3>
          <Bars rows={[...snap.hourly].sort((a, b) => num(a.hr) - num(b.hr)).map((h) => ({ key: String(h.hr), label: hrLabel(h.hr), v: num(h.total) }))} hot={new Set(st.peak.map(String))} />
        </div>
        <div>
          <h3 style={h3}>เฉลี่ยตามวันในสัปดาห์</h3>
          <Bars rows={[...snap.dow].sort((a, b) => num(a.dow) - num(b.dow)).map((d) => ({ key: String(d.dow), label: DOW[num(d.dow)], v: num(d.avg_total) }))} hot={new Set(st.bestDow ? [String(st.bestDow.dow)] : [])} />
        </div>
      </div>

      <h3 style={h3}>รายได้และรายจ่ายรายเดือน</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead><tr><th style={th}>เดือน</th><th style={{ ...th, ...r }}>รายได้สุทธิ</th><th style={{ ...th, ...r }}>รายจ่าย</th><th style={{ ...th, ...r }}>กำไร</th><th style={th}></th></tr></thead>
          <tbody>
            {[...snap.monthly].sort((a, b) => (a.month < b.month ? 1 : -1)).map((m) => (
              <tr key={m.month}>
                <td style={td}>{monthLabel(m.month)}</td>
                <td style={{ ...td, ...r }}>{baht(m.net_revenue)}</td>
                <td style={{ ...td, ...r }}>{baht(m.total_expense)}</td>
                <td style={{ ...td, ...r }}>{baht(m.net_profit)}</td>
                <td style={td}>{num(m.total_expense) < num(m.net_revenue) * 0.3 && <b style={{ color: "#b45309", fontSize: 12 }}>รายจ่ายอาจไม่ครบ</b>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notes.length > 0 && (
        <>
          <h3 style={h3}>หมายเหตุคุณภาพข้อมูล</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{notes.map((t) => (<li key={t} style={{ marginBottom: 4 }}>{t}</li>))}</ul>
        </>
      )}
    </section>
  );
}
