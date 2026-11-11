"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import "../bento.css";

interface FrydayFile {
  id: string;
  name: string;
  fileType: string;
  category: string;
  url: string;
  size: number;
  uploadedBy: string | null;
  date: string | null;
  createdAt: string;
}

const CATEGORIES = ["ทั่วไป", "เมนู", "การเงิน", "Marketing"];
const FILE_TYPES  = ["รูปภาพ", "เอกสาร", "วิดีโอ", "อื่นๆ"];

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  รูปภาพ: { bg: "#FDE1DA", color: "#8F1B0B" },
  เอกสาร: { bg: "#FFF0D6", color: "#8A5300" },
  วิดีโอ: { bg: "#2A0B07", color: "#FFD9CE" },
  "อื่นๆ": { bg: "#F1EBE7", color: "#6B5A54" },
};
const CAT_STYLE: Record<string, { bg: string; color: string }> = {
  เมนู:       { bg: "#FFE9DF", color: "#8A3A16" },
  การเงิน:   { bg: "#E3F1E6", color: "#1F5A2E" },
  Marketing: { bg: "#FDE1DA", color: "#8F1B0B" },
  ทั่วไป:    { bg: "#F1EBE7", color: "#6B5A54" },
};

function formatSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
}

// ---- Upload Zone ----
function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState<string | null>(null);
  const [category, setCategory]   = useState("ทั่วไป");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(`กำลังอัปโหลด ${file.name}...`);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    try {
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) throw new Error("อัปโหลดไม่สำเร็จ");
      setProgress(`อัปโหลด ${file.name} สำเร็จ!`);
      setTimeout(() => { setProgress(null); onUploaded(); }, 1500);
    } catch {
      setProgress(`อัปโหลดไม่สำเร็จ`);
      setTimeout(() => setProgress(null), 2000);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(uploadFile);
  };

  return (
    <section className="bn-card">
      <div className="bn-head">
        <h2>อัปโหลดไฟล์</h2>
        <div className="bn-pills" role="group" aria-label="หมวดหมู่ที่จะอัปโหลด">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="bn-pill" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div
        role="button" tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        style={{ border: `2px dashed ${dragging ? "#C0200A" : "#E2C6BC"}`, borderRadius: 20, padding: "30px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "#FDE8E4" : "#FBF4F0", transition: "all 0.15s" }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 15, color: "#2A0B07", fontWeight: 600 }}>
          {uploading ? progress : "คลิกหรือลากไฟล์มาวางที่นี่"}
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: "#7A6A64" }}>
          รองรับทุกประเภทไฟล์ เช่น รูปภาพ PDF Excel Word วิดีโอ
        </p>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {progress && !uploading && (
        <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: progress.includes("สำเร็จ!") ? "#1F5A2E" : "#B3200A", textAlign: "center" }}>
          {progress}
        </p>
      )}
    </section>
  );
}

// ---- File Card ----
function FileCard({ file }: { file: FrydayFile }) {
  const ts = TYPE_STYLE[file.fileType] ?? TYPE_STYLE["อื่นๆ"];
  const cs = CAT_STYLE[file.category]  ?? CAT_STYLE["ทั่วไป"];
  const img = isImage(file.url);

  return (
    <div style={{ background: "#fff", border: "1px solid #EBD9D2", borderRadius: 22, overflow: "hidden" }}>
      <div style={{ height: 120, background: "#FBF4F0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 22, fontWeight: 600, color: ts.color, background: ts.bg, borderRadius: 16, padding: "14px 20px" }}>{file.fileType}</span>
        }
      </div>
      <div style={{ padding: "12px 14px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 600, color: "#2A0B07", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>{file.name}</p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          <span className="bn-tag" style={{ background: ts.bg, color: ts.color }}>{file.fileType}</span>
          <span className="bn-tag" style={{ background: cs.bg, color: cs.color }}>{file.category}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: "#7A6A64" }}>{formatSize(file.size)} · {formatDate(file.date)}</span>
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="bn-pill" style={{ padding: "4px 12px", fontSize: 12 }}>เปิด ↗</a>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function FilesPage() {
  const [files, setFiles]           = useState<FrydayFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [catFilter, setCatFilter]   = useState("ทั้งหมด");
  const [typeFilter, setTypeFilter] = useState("ทั้งหมด");
  const [search, setSearch]         = useState("");

  const fetchFiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (catFilter !== "ทั้งหมด")  params.set("category", catFilter);
      if (typeFilter !== "ทั้งหมด") params.set("type", typeFilter);
      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) throw new Error("โหลดไม่สำเร็จ");
      const data = await res.json();
      setFiles(data.files);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [catFilter, typeFilter]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const filtered = files.filter((f) =>
    search === "" || f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="bn">
      <section className="bn-hero">
        <div>
          <h1>ไฟล์งาน Fryday</h1>
          <p>เก็บเมนู เอกสารการเงิน และไฟล์ Marketing ไว้ที่เดียว</p>
        </div>
        <div className="bn-hero-side">
          {!loading && <div className="bn-kpi"><b>{files.length}</b><span>ไฟล์ทั้งหมด</span></div>}
          <button className="bn-ghost" onClick={fetchFiles}>รีเฟรช</button>
        </div>
      </section>

      <UploadZone onUploaded={fetchFiles} />

      <section className="bn-card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <input type="search" aria-label="ค้นหาชื่อไฟล์" placeholder="ค้นหาชื่อไฟล์..." value={search} onChange={(e) => setSearch(e.target.value)} className="bn-in" style={{ width: 200, borderRadius: 99 }} />
          <div className="bn-pills" role="group" aria-label="กรองหมวดหมู่">
            {["ทั้งหมด", ...CATEGORIES].map((c) => <button key={c} className="bn-pill" aria-pressed={catFilter === c} onClick={() => setCatFilter(c)}>{c}</button>)}
          </div>
          <div className="bn-pills" role="group" aria-label="กรองประเภทไฟล์">
            {["ทั้งหมด", ...FILE_TYPES].map((t) => <button key={t} className="bn-pill" aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>{t}</button>)}
          </div>
        </div>
        <p className="bn-sub" style={{ margin: "0 0 12px" }}>{loading ? "กำลังโหลด..." : `แสดง ${filtered.length} ไฟล์`}</p>
        {error && <p className="bn-err" role="alert">{error}</p>}
        {!loading && !error && (
          filtered.length === 0
            ? <p className="bn-empty">ยังไม่มีไฟล์ ลองอัปโหลดไฟล์แรกได้เลย</p>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
                {filtered.map((f) => <FileCard key={f.id} file={f} />)}
              </div>
        )}
      </section>
    </main>
  );
}
