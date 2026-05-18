"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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

const TYPE_ICON: Record<string, string> = {
  รูปภาพ: "🖼️", เอกสาร: "📄", วิดีโอ: "🎬", "อื่นๆ": "📎",
};
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  รูปภาพ: { bg: "#EAF3DE", color: "#27500A" },
  เอกสาร: { bg: "#E6F1FB", color: "#185FA5" },
  วิดีโอ: { bg: "#EEEDFE", color: "#3C3489" },
  "อื่นๆ": { bg: "#F1EFE8", color: "#5F5E5A" },
};
const CAT_STYLE: Record<string, { bg: string; color: string }> = {
  เมนู:       { bg: "#FAEEDA", color: "#854F0B" },
  การเงิน:   { bg: "#EAF3DE", color: "#27500A" },
  Marketing: { bg: "#EEEDFE", color: "#3C3489" },
  ทั่วไป:    { bg: "#F1EFE8", color: "#5F5E5A" },
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
      setProgress(`✅ อัปโหลด ${file.name} สำเร็จ!`);
      setTimeout(() => { setProgress(null); onUploaded(); }, 1500);
    } catch {
      setProgress(`❌ อัปโหลดไม่สำเร็จ`);
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
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a18" }}>📎 อัปโหลดไฟล์</p>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {CATEGORIES.map((c) => {
            const st = CAT_STYLE[c] ?? CAT_STYLE["ทั่วไป"];
            return (
              <button key={c} onClick={() => setCategory(c)} style={{
                fontSize: 12, padding: "4px 12px", borderRadius: 99, cursor: "pointer",
                border: `0.5px solid ${category === c ? st.color : "#d3d1c7"}`,
                background: category === c ? st.bg : "transparent",
                color: category === c ? st.color : "#73726c",
                fontWeight: category === c ? 500 : 400,
              }}>{c}</button>
            );
          })}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragging ? "#534AB7" : "#d3d1c7"}`,
          borderRadius: 10, padding: "32px 20px", textAlign: "center",
          cursor: "pointer", background: dragging ? "#EEEDFE" : "#faf9f5",
          transition: "all 0.15s",
        }}
      >
        <p style={{ margin: "0 0 6px", fontSize: 28 }}>📂</p>
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "#1a1a18", fontWeight: 500 }}>
          {uploading ? progress : "คลิกหรือลากไฟล์มาวางที่นี่"}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "#73726c" }}>
          รองรับทุกประเภทไฟล์ — รูปภาพ, PDF, Excel, Word, วิดีโอ
        </p>
        <input
          ref={fileRef} type="file" multiple hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {progress && !uploading && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: progress.startsWith("✅") ? "#27500A" : "#A32D2D", textAlign: "center" }}>
          {progress}
        </p>
      )}
    </div>
  );
}

// ---- File Card ----
function FileCard({ file }: { file: FrydayFile }) {
  const ts = TYPE_STYLE[file.fileType] ?? TYPE_STYLE["อื่นๆ"];
  const cs = CAT_STYLE[file.category]  ?? CAT_STYLE["ทั่วไป"];
  const img = isImage(file.url);

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e3db", borderRadius: 12, overflow: "hidden" }}>
      {/* Preview */}
      <div style={{ height: 120, background: "#f6f5f0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {img
          ? <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 48 }}>{TYPE_ICON[file.fileType] ?? "📎"}</span>
        }
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, color: "#1a1a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
          {file.name}
        </p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: ts.bg, color: ts.color }}>{file.fileType}</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: cs.bg, color: cs.color }}>{file.category}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#73726c" }}>{formatSize(file.size)} · {formatDate(file.date)}</span>
          <a href={file.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 99, textDecoration: "none",
            background: "#E6F1FB", color: "#185FA5", border: "0.5px solid #B5D4F4",
          }}>
            เปิด ↗
          </a>
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

  const btnStyle = (active: boolean, bg: string, color: string): React.CSSProperties => ({
    fontSize: 12, padding: "5px 12px", borderRadius: 99, cursor: "pointer",
    border: `0.5px solid ${active ? color : "#d3d1c7"}`,
    background: active ? bg : "transparent",
    color: active ? color : "#73726c",
    fontWeight: active ? 500 : 400,
  });

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "#1a1a18" }}>📁 Fryday — ไฟล์งาน</h1>
        <button onClick={fetchFiles} style={{ ...btnStyle(false, "", ""), marginLeft: "auto" }}>🔄 รีเฟรช</button>
      </div>

      {/* Upload Zone */}
      <UploadZone onUploaded={fetchFiles} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <input
          type="text" placeholder="🔍 ค้นหาชื่อไฟล์..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 13, padding: "6px 12px", borderRadius: 99, border: "0.5px solid #d3d1c7", background: "#fff", color: "#1a1a18", width: 180 }}
        />

        {/* Category filter */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["ทั้งหมด", ...CATEGORIES].map((c) => {
            const st = CAT_STYLE[c] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
            return <button key={c} onClick={() => setCatFilter(c)} style={btnStyle(catFilter === c, st.bg, st.color)}>{c}</button>;
          })}
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["ทั้งหมด", ...FILE_TYPES].map((t) => {
            const st = TYPE_STYLE[t] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
            return <button key={t} onClick={() => setTypeFilter(t)} style={btnStyle(typeFilter === t, st.bg, st.color)}>{TYPE_ICON[t] ?? ""} {t}</button>;
          })}
        </div>
      </div>

      {/* Summary */}
      <p style={{ fontSize: 13, color: "#73726c", marginBottom: 14 }}>
        {loading ? "กำลังโหลด..." : `ไฟล์ทั้งหมด ${filtered.length} ไฟล์`}
      </p>

      {error && <p style={{ color: "#A32D2D", fontSize: 14 }}>❌ {error}</p>}

      {/* Grid */}
      {!loading && !error && (
        filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>📂</p>
              <p style={{ fontSize: 14 }}>ยังไม่มีไฟล์ — ลองอัปโหลดไฟล์แรกได้เลย</p>
            </div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {filtered.map((f) => <FileCard key={f.id} file={f} />)}
            </div>
      )}
    </main>
  );
}