"use client";

import { useState } from "react";

/* กล่องใส่รหัสผ่านสำหรับฟีเจอร์ AI ใช้รหัสผ่านเดียวกับหน้า Roadmap (จำไว้ 14 วัน) */
export default function AiLogin({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!pw || busy) return;
    setBusy(true); setErr("");
    const res = await fetch("/api/roadmap/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) { setPw(""); onDone(); } else setErr(d.error ?? "เชื่อมต่อไม่ได้");
  };

  return (
    <div role="group" aria-label="ใส่รหัสผ่านเพื่อใช้ AI" style={{ margin: "10px 0", padding: 14, background: "#fff", border: "1px solid #F5C0B8", borderRadius: 12, maxWidth: 360 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 600 }}>🔒 ใส่รหัสผ่านก่อนใช้ AI</p>
      <input type="password" autoFocus aria-label="รหัสผ่าน" placeholder="รหัสผ่าน" value={pw}
        onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
        style={{ width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, padding: "8px 10px", border: "1px solid #e5e3db", borderRadius: 8 }} />
      {err && <p role="alert" style={{ margin: "6px 0 0", fontSize: 12.5, color: "#A32D2D" }}>❌ {err}</p>}
      <button onClick={go} disabled={!pw || busy} style={{ marginTop: 8, font: "inherit", fontSize: 14, padding: "8px 16px", border: "none", borderRadius: 8, background: "#C0200A", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: !pw || busy ? 0.6 : 1 }}>
        {busy ? "กำลังตรวจ…" : "เข้าใช้งาน"}
      </button>
    </div>
  );
}
