"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

interface RestaurantData {
  tasks: { name: string; status: string; priority: string; deadline: string | null; assignee: string | null }[];
  finance: { totalRevenue: number; totalExpense: number; netProfit: number; sharePerPerson: number } | null;
  campaigns: { title: string; status: string; postDate: string | null }[];
}

const QUICK_PROMPTS = [
  { label: "📋 งานวันนี้", prompt: "มีงานอะไรบ้างที่ต้องทำวันนี้? และงานไหนเร่งด่วน?" },
  { label: "💰 ยอดขายเดือนนี้", prompt: "สรุปยอดขายและกำไรเดือนนี้ให้หน่อย พร้อมส่วนแบ่งหุ้นส่วน" },
  { label: "📣 แผน Marketing", prompt: "ดูแผน Marketing ที่รอดำเนินการทั้งหมดให้หน่อย" },
  { label: "🔍 วิเคราะห์ร้าน", prompt: "วิเคราะห์สถานการณ์ร้าน Fryday ตอนนี้ และแนะนำสิ่งที่ควรทำ" },
  { label: "💡 แนะนำโปรโมชัน", prompt: "ช่วยแนะนำไอเดียโปรโมชันสำหรับร้านไก่ทอด Fryday" },
  { label: "📊 รายงานสรุป", prompt: "สร้างรายงานสรุปภาพรวมร้าน Fryday ให้หน่อย" },
];

function formatBaht(n: number) {
  return new Intl.NumberFormat("th-TH").format(Math.round(n));
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 20 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#C0200A",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12, gap: 8, alignItems: "flex-end",
    }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#C0200A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          🍗
        </div>
      )}
      <div style={{
        maxWidth: "80%", padding: "10px 14px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "#C0200A" : "#fff",
        border: isUser ? "none" : "0.5px solid #e5e3db",
        color: isUser ? "#fff" : "#1a1a18",
        fontSize: 14, lineHeight: 1.6,
        boxShadow: isUser ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        {msg.loading ? <TypingDots /> : (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        )}
      </div>
      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FEE9E7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#C0200A", flexShrink: 0 }}>
          A
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "สวัสดีครับ! 🍗 ผมคือ Fryday AI Assistant ช่วยจัดการร้านไก่ทอด Fryday ได้เลยครับ\n\nถามได้ทุกอย่างเลยครับ เช่น งานที่ค้างอยู่ ยอดขาย แผน Marketing หรือขอคำแนะนำสำหรับร้าน",
    }
  ]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState<RestaurantData | null>(null);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLTextAreaElement>(null);

  // ดึงข้อมูลร้านเพื่อให้ AI มี context
  const fetchRestaurantData = useCallback(async () => {
    try {
      const month = new Date().toISOString().slice(0, 7);
      const [tRes, fRes, mRes] = await Promise.all([
        fetch("/api/tasks?done=false"),
        fetch(`/api/finance?month=${month}`),
        fetch("/api/marketing"),
      ]);
      const tasks     = tRes.ok ? (await tRes.json()).tasks ?? [] : [];
      const finData   = fRes.ok ? (await fRes.json()).summary : null;
      const campaigns = mRes.ok ? (await mRes.json()).campaigns ?? [] : [];
      setData({ tasks, finance: finData, campaigns });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchRestaurantData(); }, [fetchRestaurantData]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const buildSystemPrompt = () => {
    const today = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    let ctx = `คุณคือ Fryday AI Assistant ผู้ช่วยจัดการร้านอาหาร "Fryday" ร้านไก่ทอดและเครื่องดื่ม มีหุ้นส่วน 3 คน
วันนี้คือ: ${today}
ตอบเป็นภาษาไทยเสมอ กระชับ ชัดเจน เป็นมิตร ใช้ emoji ประกอบบ้าง
ถ้ามีข้อมูลจริงจากระบบ ให้อ้างอิงข้อมูลนั้น

ข้อมูลจากระบบ Fryday:\n`;

    if (data) {
      // Tasks
      const overdue = data.tasks.filter(t => t.deadline && t.deadline < new Date().toISOString().split("T")[0]);
      const urgent  = data.tasks.filter(t => t.priority === "ด่วนมาก");
      ctx += `\n📋 งานคงค้าง: ${data.tasks.length} รายการ`;
      ctx += `\n- เกิน Deadline: ${overdue.length} รายการ`;
      ctx += `\n- ด่วนมาก: ${urgent.length} รายการ`;
      if (data.tasks.length > 0) {
        ctx += `\n- รายการงาน: ${data.tasks.slice(0, 10).map(t => `"${t.name}" (${t.status}${t.deadline ? `, deadline: ${t.deadline}` : ""}${t.assignee ? `, ผู้รับผิดชอบ: ${t.assignee}` : ""})`).join(", ")}`;
      }

      // Finance
      if (data.finance) {
        ctx += `\n\n💰 การเงินเดือนนี้:`;
        ctx += `\n- รายรับ: ฿${formatBaht(data.finance.totalRevenue)}`;
        ctx += `\n- รายจ่าย: ฿${formatBaht(data.finance.totalExpense)}`;
        ctx += `\n- กำไรสุทธิ: ฿${formatBaht(data.finance.netProfit)}`;
        ctx += `\n- ส่วนแบ่ง/คน: ฿${formatBaht(data.finance.sharePerPerson)}`;
      }

      // Marketing
      ctx += `\n\n📣 แคมเปญ Marketing: ${data.campaigns.length} รายการ`;
      const pending = data.campaigns.filter(c => c.status !== "โพสต์แล้ว");
      ctx += `\n- รอดำเนินการ: ${pending.length} รายการ`;
      if (pending.length > 0) {
        ctx += `\n- ${pending.slice(0, 5).map(c => `"${c.title}" (${c.status}${c.postDate ? `, ${c.postDate}` : ""})`).join(", ")}`;
      }
    }

    ctx += `\n\nสามารถแนะนำ:\n- วิเคราะห์ปัญหาและโอกาส\n- ไอเดียโปรโมชันและ Marketing\n- การจัดการงานและทีม\n- การวางแผนการเงิน\n- กลยุทธ์ร้านอาหาร`;
    return ctx;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    const loadingMsg: Message = { id: "loading", role: "assistant", content: "", loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    try {
      // สร้าง conversation history สำหรับ API
      const history = messages
        .filter(m => !m.loading && m.id !== "welcome")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: [
            ...history,
            { role: "user", content: text.trim() },
          ],
        }),
      });

      const result = await response.json();
      const reply  = result.content?.find((c: { type: string }) => c.type === "text")?.text ?? "ขออภัย ไม่สามารถตอบได้ในขณะนี้ครับ";

      setMessages(prev => prev.map(m =>
        m.id === "loading"
          ? { id: Date.now().toString(), role: "assistant", content: reply }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === "loading"
          ? { id: Date.now().toString(), role: "assistant", content: "❌ ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ" }
          : m
      ));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", maxWidth: 680, margin: "0 auto", fontFamily: "sans-serif" }}>

        {/* Chat Header */}
        <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "0.5px solid #e5e3db", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#C0200A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍗</div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a18" }}>Fryday AI Assistant</p>
            <p style={{ margin: 0, fontSize: 11, color: "#1D9E75" }}>● ออนไลน์ · มีข้อมูลร้านแบบ Real-time</p>
          </div>
          <button onClick={() => { fetchRestaurantData(); }} style={{ marginLeft: "auto", fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #e5e3db", background: "transparent", color: "#73726c", cursor: "pointer" }}>
            🔄 อัปเดตข้อมูล
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", background: "#FBF8F5" }}>

          {/* Quick data summary */}
          {data && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "#FEE9E7", color: "#C0200A", border: "0.5px solid #F5C0B8" }}>
                📋 {data.tasks.length} งาน
              </div>
              {data.finance && (
                <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "#EAF3DE", color: "#27500A", border: "0.5px solid #C0DD97" }}>
                  💰 ฿{formatBaht(data.finance.netProfit)} กำไร
                </div>
              )}
              <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "#EEEDFE", color: "#3C3489", border: "0.5px solid #CECBF6" }}>
                📣 {data.campaigns.length} แคมเปญ
              </div>
            </div>
          )}

          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}

          {/* Quick Prompts — แสดงเมื่อยังไม่มีการโต้ตอบ */}
          {messages.length <= 1 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 12, color: "#73726c", marginBottom: 8, textAlign: "center" }}>เลือกคำถามด่วน หรือพิมพ์เองได้เลย</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {QUICK_PROMPTS.map((q) => (
                  <button key={q.label} onClick={() => sendMessage(q.prompt)} style={{
                    padding: "10px 12px", borderRadius: 10, border: "0.5px solid #e5e3db",
                    background: "#fff", color: "#1a1a18", fontSize: 12, cursor: "pointer",
                    textAlign: "left", fontWeight: 500, lineHeight: 1.4,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 12px", background: "#fff", borderTop: "0.5px solid #e5e3db" }}>
          {/* Quick prompts bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto", paddingBottom: 4 }}>
            {QUICK_PROMPTS.map((q) => (
              <button key={q.label} onClick={() => sendMessage(q.prompt)} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 99, whiteSpace: "nowrap",
                border: "0.5px solid #e5e3db", background: "#faf9f5", color: "#73726c",
                cursor: "pointer", flexShrink: 0,
              }}>
                {q.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ถามเกี่ยวกับร้าน Fryday... (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)"
              disabled={loading}
              rows={1}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 20, border: "0.5px solid #d3d1c7",
                background: "#faf9f5", fontSize: 14, color: "#1a1a18", resize: "none",
                outline: "none", fontFamily: "sans-serif", lineHeight: 1.5, maxHeight: 120,
                overflowY: "auto",
              }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: "50%", border: "none",
                background: loading || !input.trim() ? "#f0ede8" : "#C0200A",
                color: loading || !input.trim() ? "#aaa" : "#fff",
                fontSize: 16, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              {loading ? "⏳" : "↑"}
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 10, color: "#aaa", textAlign: "center" }}>
            AI ใช้ข้อมูลจริงจากระบบ Fryday · Claude Sonnet
          </p>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { background: #FBF8F5; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e5e3db; border-radius: 99px; }
        @media (max-width: 640px) {
          textarea { font-size: 16px !important; }
        }
      `}</style>
    </>
  );
}