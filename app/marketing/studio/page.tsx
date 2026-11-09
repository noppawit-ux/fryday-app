"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/* ---------- Fryday Studio: คลิป "พิกัดร้าน" 9:16 ----------
   วาดบน canvas 1080x1920 แล้วอัดเป็นไฟล์วิดีโอในเบราว์เซอร์ (MediaRecorder)
   ฟุตเทจและไฟล์ที่เลือกไม่ถูกอัปโหลดไปไหน อยู่ในเครื่องเท่านั้น */

const W = 1080, H = 1920, FPS = 30;
const RED = "#C0200A", MUTED = "#73726c", LINE = "#e5e3db", YELLOW = "#FFD83D";
const FONT = `'Prompt','Noto Sans Thai',sans-serif`;

type Kind = "hook" | "map" | "drive" | "landmark" | "arrive" | "inside" | "logo" | "search";
interface Seg { id: string; kind: Kind; label: string; dur: number; caption: string; media: boolean; hint: string }
interface Info { name: string; area: string; province: string; address: string; hours: string; handle: string }
interface Media { type: "video" | "image"; el: HTMLVideoElement | HTMLImageElement; name: string }

const DEFAULT_INFO: Info = {
  name: "Fryday", area: "", province: "อุดรธานี", address: "", hours: "", handle: "",
};

const DEFAULT_SEGS: Seg[] = [
  { id: "hook", kind: "hook", label: "1 · ฮุก หน้าร้าน", dur: 3, caption: "", media: true, hint: "หน้าร้านเห็นป้ายชัด ถ่ายตอนไฟเปิด" },
  { id: "map", kind: "map", label: "2 · แผนที่ซูม", dur: 2, caption: "", media: false, hint: "วาดให้อัตโนมัติ" },
  { id: "d1", kind: "drive", label: "3 · ขับรถ ช่วงที่ 1", dur: 2.2, caption: "ใครมาทางนี้…", media: true, hint: "ถ่ายผ่านกระจกหน้ารถ ทางหลัก" },
  { id: "d2", kind: "drive", label: "4 · ขับรถ ช่วงที่ 2", dur: 2.2, caption: "ให้มองมาทางด้านขวา", media: true, hint: "ช่วงสี่แยกหรือทางเข้าซอย" },
  { id: "d3", kind: "drive", label: "5 · ขับรถ ช่วงที่ 3", dur: 2.2, caption: "ตรงไปอีกนิดเดียว", media: true, hint: "ใกล้ถึงร้าน" },
  { id: "lm", kind: "landmark", label: "6 · จุดสังเกต", dur: 2.2, caption: "ติด 3 แยกไฟแดง", media: true, hint: "ป้าย ปั๊ม หรือโรงเรียนข้างร้าน" },
  { id: "ar", kind: "arrive", label: "7 · ถึงร้าน", dur: 2.5, caption: "มาไม่ยากเลย", media: true, hint: "หน้าร้านยืนนิ่ง" },
  { id: "in1", kind: "inside", label: "8 · ในร้าน ภาพที่ 1", dur: 3, caption: "", media: true, hint: "ลูกค้านั่งกิน อาหารบนโต๊ะ" },
  { id: "in2", kind: "inside", label: "9 · ในร้าน ภาพที่ 2", dur: 3, caption: "", media: true, hint: "เกมบนโต๊ะ หรือบรรยากาศ" },
  { id: "logo", kind: "logo", label: "10 · โลโก้", dur: 2, caption: "", media: false, hint: "ใส่ไฟล์โลโก้ด้านล่างได้" },
  { id: "se", kind: "search", label: "11 · หน้าค้นหา", dur: 2.5, caption: "ค้นหาได้เลย", media: false, hint: "แถบค้นหาพิมพ์ชื่อบัญชี" },
];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eo = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const back = (x: number) => { const c = 1.70158, t = clamp(x) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };

/* ตัดบรรทัดภาษาไทยตามคำ */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const seg = typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter("th", { granularity: "word" }).segment(para), (s) => s.segment)
      : para.split(/(?<=\s)/);
    let line = "";
    for (const w of seg) {
      if (line && ctx.measureText(line + w).width > maxW) { out.push(line.trim()); line = w; } else line += w;
    }
    if (line.trim()) out.push(line.trim());
  }
  return out;
}

interface TextOpt { size: number; color?: string; stroke?: string; weight?: number; maxW?: number; lh?: number; align?: CanvasTextAlign; alpha?: number; scale?: number }
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpt): number {
  if (!s) return 0;
  const { size, color = "#fff", stroke, weight = 700, maxW = 900, lh = 1.22, align = "center", alpha = 1, scale = 1 } = o;
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "top"; ctx.globalAlpha = alpha;
  const lines = wrap(ctx, s, maxW);
  const h = lines.length * size * lh;
  ctx.translate(x, y + h / 2); ctx.scale(scale, scale); ctx.translate(-x, -(y + h / 2));
  ctx.lineJoin = "round";
  lines.forEach((ln, i) => {
    const yy = y + i * size * lh;
    ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    if (stroke) { ctx.lineWidth = size * 0.16; ctx.strokeStyle = stroke; ctx.strokeText(ln, x, yy); }
    ctx.fillStyle = color; ctx.fillText(ln, x, yy);
  });
  ctx.restore();
  return h;
}

function cover(ctx: CanvasRenderingContext2D, m: Media | undefined, zoom: number): boolean {
  if (!m) return false;
  const el = m.el;
  const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!sw || !sh || (el instanceof HTMLVideoElement && el.readyState < 2)) return false;
  const s = Math.max(W / sw, H / sh) * zoom;
  ctx.drawImage(el, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
  return true;
}

function placeholder(ctx: CanvasRenderingContext2D, seg: Seg) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1b1b22"); g.addColorStop(1, "#0a0a0d");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.setLineDash([22, 18]); ctx.lineWidth = 4;
  ctx.strokeRect(90, 620, W - 180, 700); ctx.setLineDash([]);
  text(ctx, "ใส่ฟุตเทจช็อตนี้", W / 2, 880, { size: 54, color: "rgba(255,255,255,.7)", maxW: 800 });
  text(ctx, seg.hint, W / 2, 970, { size: 38, color: "rgba(255,255,255,.45)", weight: 500, maxW: 800 });
}

/* พื้นที่จังหวัดแบบเส้นขอบสุ่มคงที่ (ไม่ใช่แผนที่จริง) */
function blob(cx: number, cy: number, r: number, seed = 7): [number, number][] {
  const pts: [number, number][] = [];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = 22;
  const rr = Array.from({ length: n }, () => 0.72 + rnd() * 0.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = (rr[i] + rr[(i + 1) % n] + rr[(i + n - 1) % n]) / 3;
    pts.push([cx + Math.cos(a) * r * k * 1.1, cy + Math.sin(a) * r * k * 0.95]);
  }
  return pts;
}

function drawMap(ctx: CanvasRenderingContext2D, info: Info, p: number, lt: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#2f7d32"); g.addColorStop(0.5, "#6f9a2c"); g.addColorStop(1, "#1d5a30");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) { ctx.beginPath(); ctx.moveTo(i * 60, 0); ctx.lineTo(i * 60 - 400, H); ctx.stroke(); }
  const z = 0.75 + eo(p) * 0.75;
  ctx.save();
  ctx.translate(W / 2, 980); ctx.scale(z, z); ctx.translate(-W / 2, -980);
  const pts = blob(W / 2, 980, 330);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = "rgba(60,60,60,.85)"; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18; ctx.fill();
  ctx.shadowColor = "transparent"; ctx.lineWidth = 9 / z; ctx.strokeStyle = "#ff5fa8"; ctx.shadowColor = "#ff5fa8"; ctx.shadowBlur = 24; ctx.stroke();
  ctx.restore();
  text(ctx, "จังหวัด" + info.province, W / 2, 940, { size: 70, color: "#ff8fc4", stroke: "#4a0f2e", alpha: eo(p * 3) });
  // หมุดหล่น
  const pp = clamp((p - 0.55) / 0.35);
  if (pp > 0) {
    const y = 770 - (1 - back(pp)) * 420;
    ctx.save(); ctx.translate(W / 2, y);
    ctx.fillStyle = RED; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 54, Math.PI, 0); ctx.lineTo(0, 110); ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  void lt;
}

function drawSearch(ctx: CanvasRenderingContext2D, info: Info, seg: Seg, p: number) {
  ctx.fillStyle = "#0f1020"; ctx.fillRect(0, 0, W, H);
  text(ctx, seg.caption || "ค้นหาได้เลย", W / 2, 640, { size: 76, color: "#fff", alpha: eo(p * 4) });
  const bx = 130, by = 880, bw = W - 260, bh = 150;
  ctx.fillStyle = "#1f2033"; ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 75); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(bx + 80, by + 70, 26, 0, Math.PI * 2); ctx.moveTo(bx + 99, by + 89); ctx.lineTo(bx + 120, by + 112); ctx.stroke();
  const full = info.handle ? (info.handle.startsWith("@") ? info.handle : "@" + info.handle) : "@ชื่อบัญชีร้าน";
  const n = Math.floor(clamp((p - 0.15) / 0.55) * full.length);
  ctx.save(); ctx.font = `600 54px ${FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = "#fff";
  const shown = full.slice(0, n);
  ctx.fillText(shown, bx + 170, by + 76);
  if (Math.floor(p * 8) % 2 === 0) ctx.fillRect(bx + 174 + ctx.measureText(shown).width, by + 40, 5, 72);
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, info: Info, logo: HTMLImageElement | null, p: number) {
  ctx.fillStyle = RED; ctx.fillRect(0, 0, W, H);
  const sc = 0.82 + 0.18 * back(p * 2.2);
  if (logo && logo.naturalWidth) {
    const k = Math.min(760 / logo.naturalWidth, 760 / logo.naturalHeight) * sc;
    const w = logo.naturalWidth * k, h = logo.naturalHeight * k;
    ctx.drawImage(logo, (W - w) / 2, 900 - h / 2, w, h);
  } else {
    text(ctx, info.name || "ชื่อร้าน", W / 2, 820, { size: 180, color: YELLOW, stroke: "#7a1406", maxW: 900, scale: sc, lh: 1.1 });
  }
}

function drawInfo(ctx: CanvasRenderingContext2D, info: Info, a: number) {
  let y = 250;
  y += text(ctx, info.name || "ชื่อร้าน", W / 2, y, { size: 84, alpha: a, weight: 800 }) + 6;
  y += text(ctx, info.address, W / 2, y, { size: 46, color: YELLOW, weight: 600, alpha: a, maxW: 860 }) + 4;
  text(ctx, info.hours, W / 2, y, { size: 46, color: "#fff", weight: 600, alpha: a, maxW: 860 });
}

function drawFrame(ctx: CanvasRenderingContext2D, segs: Seg[], info: Info, media: Map<string, Media>, logo: HTMLImageElement | null, t: number) {
  let acc = 0, idx = segs.length - 1;
  for (let i = 0; i < segs.length; i++) { if (t < acc + segs[i].dur) { idx = i; break; } acc += segs[i].dur; }
  const seg = segs[idx], lt = clamp(t - acc, 0, seg.dur), p = seg.dur ? lt / seg.dur : 0;
  ctx.clearRect(0, 0, W, H);
  if (seg.kind === "map") { drawMap(ctx, info, p, lt); return idx; }
  if (seg.kind === "logo") { drawLogo(ctx, info, logo, p); return idx; }
  if (seg.kind === "search") { drawSearch(ctx, info, seg, p); return idx; }
  const m = media.get(seg.id);
  const zoom = m?.type === "image" ? 1 + 0.08 * p : 1;
  if (!cover(ctx, m, zoom)) placeholder(ctx, seg);
  const shade = ctx.createLinearGradient(0, 0, 0, 700);
  shade.addColorStop(0, "rgba(0,0,0,.55)"); shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, 700);
  if (seg.kind === "hook") {
    text(ctx, "พิกัดร้าน", W / 2, 230, { size: 76, alpha: eo(p * 5) });
    text(ctx, info.name || "ชื่อร้าน", W / 2, 330, { size: 150, color: YELLOW, stroke: "#3a2a00", weight: 800, scale: 0.7 + 0.3 * back(p * 3), maxW: 940, lh: 1.05 });
    text(ctx, info.area, W / 2, 330 + 175, { size: 44, color: "#fff", weight: 600, alpha: eo((p - 0.15) * 4) });
  } else if (seg.kind === "inside") {
    drawInfo(ctx, info, eo(p * 5));
  } else {
    text(ctx, seg.caption, W / 2, 300, { size: 70, scale: 0.85 + 0.15 * back(p * 4), alpha: eo(p * 6), maxW: 880 });
  }
  return idx;
}

/* ---------- UI ---------- */
const card: CSSProperties = { background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 12, padding: 16 };
const input: CSSProperties = { font: "inherit", fontSize: 14, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%", background: "#fff", boxSizing: "border-box" };
const btn: CSSProperties = { font: "inherit", fontSize: 14, padding: "8px 14px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", cursor: "pointer" };
const btnPrimary: CSSProperties = { ...btn, background: RED, color: "#fff", borderColor: RED, fontWeight: 600 };
const lab: CSSProperties = { display: "block", fontSize: 12, color: MUTED, margin: "0 0 4px" };

const STORE = "fryday-studio-v1";

export default function StudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<Map<string, Media>>(new Map());
  const logoRef = useRef<HTMLImageElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioNodeRef = useRef<{ ac: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const stateRef = useRef({ segs: DEFAULT_SEGS, info: DEFAULT_INFO, t: 0, playing: false, start: 0, rec: null as MediaRecorder | null });

  const [info, setInfo] = useState<Info>(DEFAULT_INFO);
  const [segs, setSegs] = useState<Seg[]>(DEFAULT_SEGS);
  const [names, setNames] = useState<Record<string, string>>({});
  const [logoName, setLogoName] = useState("");
  const [audioName, setAudioName] = useState("");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [fmt, setFmt] = useState<"mp4" | "webm" | "">("");

  const total = segs.reduce((a, s) => a + s.dur, 0);
  const missing = segs.filter((s) => s.media && !names[s.id]).length;

  useEffect(() => { stateRef.current.segs = segs; stateRef.current.info = info; }, [segs, info]);

  // โหลดข้อความที่เคยกรอก
  useEffect(() => {
    queueMicrotask(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw) as { info?: Info; caps?: Record<string, string>; durs?: Record<string, number> };
        if (d.info) setInfo({ ...DEFAULT_INFO, ...d.info });
        setSegs(DEFAULT_SEGS.map((s) => ({ ...s, caption: d.caps?.[s.id] ?? s.caption, dur: d.durs?.[s.id] ?? s.dur })));
      }
    } catch { /* ใช้ค่าเริ่มต้น */ }
    });
    document.fonts?.load(`700 60px ${FONT}`).catch(() => {});
    document.fonts?.load(`800 60px ${FONT}`).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        info,
        caps: Object.fromEntries(segs.map((s) => [s.id, s.caption])),
        durs: Object.fromEntries(segs.map((s) => [s.id, s.dur])),
      }));
    } catch { /* ไม่เป็นไร */ }
  }, [info, segs]);

  // ลูปวาดภาพ
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0, lastIdx = -1, lastScrub = -1;
    const loop = () => {
      const s = stateRef.current;
      const tot = s.segs.reduce((a, x) => a + x.dur, 0);
      if (s.playing) {
        s.t = (performance.now() - s.start) / 1000;
        if (s.t >= tot) {
          s.t = tot - 0.001; s.playing = false;
          if (s.rec?.state === "recording") s.rec.stop();
          audioRef.current?.pause();
          setPlaying(false);
        }
        setT(s.t);
      }
      const idx = drawFrame(ctx, s.segs, s.info, mediaRef.current, logoRef.current, s.t);
      // ควบคุมวิดีโอของช็อตปัจจุบัน
      const seg = s.segs[idx];
      if (idx !== lastIdx) {
        const prev = s.segs[lastIdx]; const pm = prev && mediaRef.current.get(prev.id);
        if (pm?.type === "video") (pm.el as HTMLVideoElement).pause();
        const cm = mediaRef.current.get(seg.id);
        if (cm?.type === "video" && s.playing) { const v = cm.el as HTMLVideoElement; v.currentTime = 0; v.play().catch(() => {}); }
        lastIdx = idx;
      }
      if (!s.playing && Math.abs(s.t - lastScrub) > 0.03) {
        const cm = mediaRef.current.get(seg.id);
        if (cm?.type === "video") {
          let a = 0; for (let i = 0; i < idx; i++) a += s.segs[i].dur;
          const v = cm.el as HTMLVideoElement; const d = v.duration || 1;
          v.currentTime = Math.min(Math.max(0, s.t - a), d - 0.05);
        }
        lastScrub = s.t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const addMedia = useCallback((id: string, file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const old = mediaRef.current.get(id);
    if (old?.type === "video") (old.el as HTMLVideoElement).pause();
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.loop = true; v.src = url;
      v.onloadeddata = () => { v.currentTime = 0; };
      mediaRef.current.set(id, { type: "video", el: v, name: file.name });
    } else {
      const im = new Image(); im.src = url;
      mediaRef.current.set(id, { type: "image", el: im, name: file.name });
    }
    setNames((n) => ({ ...n, [id]: file.name }));
  }, []);

  const addLogo = (file: File | undefined) => {
    if (!file) return;
    const im = new Image(); im.src = URL.createObjectURL(file);
    logoRef.current = im; setLogoName(file.name);
  };

  const addAudio = (file: File | undefined) => {
    if (!file) return;
    audioRef.current?.pause();
    const a = new Audio(URL.createObjectURL(file)); a.loop = false;
    audioRef.current = a; audioNodeRef.current = null; setAudioName(file.name);
  };

  const begin = (record: boolean) => {
    const s = stateRef.current; const canvas = canvasRef.current; if (!canvas) return;
    setMsg("");
    s.t = 0; s.start = performance.now(); s.playing = true; setPlaying(true);
    const a = audioRef.current;
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
    const first = mediaRef.current.get(s.segs[0].id);
    if (first?.type === "video") { const v = first.el as HTMLVideoElement; v.currentTime = 0; v.play().catch(() => {}); }
    if (!record) return;

    const stream = canvas.captureStream(FPS);
    if (a) {
      if (!audioNodeRef.current) {
        const ac = new AudioContext(); const src = ac.createMediaElementSource(a); const dest = ac.createMediaStreamDestination();
        src.connect(dest); src.connect(ac.destination); audioNodeRef.current = { ac, dest };
      }
      audioNodeRef.current.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
    // ห้ามใช้ video/mp4 เปล่า ๆ: Chromium บางรุ่นจะอัด VP9 ลงกล่อง mp4 ที่แพลตฟอร์มไม่รับ
    const cands = [
      "video/mp4;codecs=avc1.64002A,mp4a.40.2", "video/mp4;codecs=avc1.4D0028,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm",
    ];
    const mime = cands.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    setFmt(ext);
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: ext === "mp4" ? "video/mp4" : "video/webm" });
      const a2 = document.createElement("a");
      a2.href = URL.createObjectURL(blob);
      a2.download = `${(s.info.name || "fryday").replace(/\s+/g, "-")}-pikat.${ext}`;
      a2.click();
      setExporting(false);
      setMsg(ext === "mp4" ? "บันทึกเป็น .mp4 แล้ว" : "บันทึกเป็น .webm แล้ว แปลงเป็น mp4 ก่อนอัปโหลดด้วย: ffmpeg -i คลิป.webm -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac คลิป.mp4");
    };
    s.rec = rec; rec.start(250); setExporting(true);
  };

  const stop = () => {
    const s = stateRef.current; s.playing = false; setPlaying(false);
    if (s.rec?.state === "recording") s.rec.stop();
    audioRef.current?.pause();
    mediaRef.current.forEach((m) => m.type === "video" && (m.el as HTMLVideoElement).pause());
  };

  const seek = (v: number) => { stateRef.current.t = v; setT(v); };
  const setSeg = (id: string, patch: Partial<Seg>) => setSegs((a) => a.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const setI = (k: keyof Info) => (e: React.ChangeEvent<HTMLInputElement>) => setInfo((i) => ({ ...i, [k]: e.target.value }));

  return (
    <main style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@500;600;700;800&display=swap" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <a href="/marketing" style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}>← Marketing</a>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>🎬 Studio · คลิป “พิกัดร้าน”</h1>
        <a href="/marketing/planner" style={{ fontSize: 13, color: MUTED, textDecoration: "none", marginLeft: "auto" }}>🗓 วางแผนคอนเทนต์ →</a>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: MUTED }}>
        กรอกข้อมูลร้าน ใส่ฟุตเทจทีละช็อต ดูตัวอย่าง แล้วกดบันทึกเป็นไฟล์ 9:16 ใช้เวลาเท่าความยาวคลิป ฟุตเทจอยู่ในเครื่องนี้เท่านั้น ไม่ถูกอัปโหลด
      </p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* พรีวิว */}
        <div style={{ ...card, flex: "0 0 auto", width: 340 }}>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", aspectRatio: "9/16", borderRadius: 10, background: "#000", display: "block" }} />
          <input type="range" min={0} max={total} step={0.05} value={Math.min(t, total)} disabled={playing} onChange={(e) => seek(parseFloat(e.target.value))} aria-label="เลื่อนดูตัวอย่าง" style={{ width: "100%", margin: "10px 0 4px" }} />
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{t.toFixed(1)} / {total.toFixed(1)} วินาที</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!playing
              ? <button style={btn} onClick={() => begin(false)}>▶ เล่นตัวอย่าง</button>
              : <button style={btn} onClick={stop}>■ หยุด</button>}
            <button style={{ ...btnPrimary, opacity: exporting || playing ? 0.6 : 1 }} disabled={exporting || playing} onClick={() => begin(true)}>
              {exporting ? "กำลังอัด… อย่าปิดหน้านี้" : "⬇ บันทึกคลิป"}
            </button>
          </div>
          {missing > 0 && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8a5a00" }}>ยังไม่ได้ใส่ฟุตเทจ {missing} ช็อต ช็อตนั้นจะเป็นกรอบดำในไฟล์</p>}
          {msg && <p role="status" style={{ margin: "10px 0 0", fontSize: 12, color: "#27500A", wordBreak: "break-word" }}>{msg}</p>}
          {fmt === "webm" && !msg && <p style={{ margin: "10px 0 0", fontSize: 12, color: MUTED }}>เบราว์เซอร์นี้อัดได้เป็น .webm ใช้ Chrome รุ่นใหม่บนคอมเพื่อให้ได้ .mp4</p>}
        </div>

        {/* ฟอร์ม */}
        <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section style={card}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>ข้อมูลร้าน</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              <label><span style={lab}>ชื่อร้าน</span><input style={input} value={info.name} onChange={setI("name")} /></label>
              <label><span style={lab}>อำเภอ / จังหวัด (ใต้ชื่อร้าน)</span><input style={input} placeholder="จ.อุดรธานี" value={info.area} onChange={setI("area")} /></label>
              <label><span style={lab}>จังหวัดสำหรับฉากแผนที่</span><input style={input} value={info.province} onChange={setI("province")} /></label>
              <label><span style={lab}>ชื่อบัญชี (หน้าค้นหา)</span><input style={input} placeholder="fryday.udon" value={info.handle} onChange={setI("handle")} /></label>
              <label style={{ gridColumn: "1/-1" }}><span style={lab}>ที่อยู่ (บรรทัดสีเหลือง)</span><input style={input} placeholder="ถนน… ตำบล… อำเภอ…" value={info.address} onChange={setI("address")} /></label>
              <label style={{ gridColumn: "1/-1" }}><span style={lab}>เวลาเปิด–ปิด</span><input style={input} placeholder="17:00 - 02:00 · ปิดวันพฤหัส" value={info.hours} onChange={setI("hours")} /></label>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 13 }}>
              <label>โลโก้ (ไม่บังคับ) <input type="file" accept="image/*" onChange={(e) => addLogo(e.target.files?.[0])} /> {logoName}</label>
              <label>เพลง (ไม่บังคับ) <input type="file" accept="audio/*" onChange={(e) => addAudio(e.target.files?.[0])} /> {audioName}</label>
            </div>
            {audioName && <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>ใช้เฉพาะเพลงที่มีสิทธิ์ใช้เชิงพาณิชย์ เพลงดังที่ไม่ได้ซื้อสิทธิ์อาจถูกปิดเสียงหรือเคลมบนแพลตฟอร์ม</p>}
          </section>

          <section style={card}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>ช็อตในคลิป</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {segs.map((s) => (
                <div key={s.id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 10, display: "grid", gridTemplateColumns: "1fr 76px", gap: 8 }}>
                  <div style={{ gridColumn: "1/-1", fontSize: 13, fontWeight: 600 }}>{s.label} <span style={{ color: MUTED, fontWeight: 400 }}>· {s.hint}</span></div>
                  {["drive", "landmark", "arrive", "search"].includes(s.kind)
                    ? <input style={input} aria-label={`ข้อความ ${s.label}`} value={s.caption} onChange={(e) => setSeg(s.id, { caption: e.target.value })} />
                    : <div style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>{s.kind === "inside" ? "แสดงชื่อ ที่อยู่ เวลาเปิด–ปิด" : s.kind === "hook" ? "แสดง “พิกัดร้าน” + ชื่อร้าน" : "สร้างอัตโนมัติ"}</div>}
                  <label style={{ fontSize: 12, color: MUTED }}>วินาที
                    <input style={{ ...input, padding: "6px 8px" }} type="number" min={1} max={8} step={0.5} value={s.dur} onChange={(e) => setSeg(s.id, { dur: clamp(parseFloat(e.target.value) || 2, 1, 8) })} />
                  </label>
                  {s.media && (
                    <label style={{ gridColumn: "1/-1", fontSize: 13 }}>
                      <input type="file" accept="video/*,image/*" onChange={(e) => addMedia(s.id, e.target.files?.[0])} /> {names[s.id] ? `✅ ${names[s.id]}` : "⬜ ยังไม่ได้ใส่"}
                    </label>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
