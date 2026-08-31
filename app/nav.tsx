"use client";

import { useState } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/",          icon: "🏠", label: "หน้าหลัก" },
    { href: "/tasks",     icon: "📋", label: "งาน" },
    { href: "https://fryday-accounting-dashboard.vercel.app", icon: "💰", label: "การเงิน" },
    { href: "/marketing", icon: "📣", label: "Marketing" },
    { href: "/calendar",  icon: "🗓", label: "ปฏิทิน" },
    { href: "/files",     icon: "📁", label: "ไฟล์งาน" },
        { href: "/chat", icon: "🤖", label: "AI Chat" },
  ];

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 56, background: "#C0200A", borderBottom: "none",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 4,
        boxShadow: "0 2px 12px rgba(192,32,10,0.3)",
      }}>
        {/* Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: 8 }}>
          <span style={{ fontSize: 22 }}>🍗</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Fryday</span>
        </a>

        {/* Desktop Links */}
        <div style={{ display: "flex", gap: 2, flex: 1 }} className="desktop-nav">
          {links.slice(1).map((l) => (
            <a key={l.href} href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 13, color: "rgba(255,255,255,0.85)", textDecoration: "none",
                padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
            >
              <span>{l.icon}</span>
              <span className="nav-label">{l.label}</span>
            </a>
          ))}
        </div>

        {/* Partner badges */}
        <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
          {["A","B","C"].map((p, i) => (
            <div key={p} style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              background: ["rgba(255,255,255,0.9)","rgba(255,255,255,0.75)","rgba(255,255,255,0.6)"][i],
              color: "#C0200A",
              border: "1.5px solid rgba(255,255,255,0.4)",
            }}>{p}</div>
          ))}
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="hamburger"
          style={{
            display: "none", background: "rgba(255,255,255,0.15)", border: "none",
            fontSize: 18, cursor: "pointer", padding: "6px 10px", borderRadius: 8,
            color: "#fff", marginLeft: 4,
          }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile Dropdown */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 56, left: 0, right: 0, zIndex: 199,
          background: "#fff", boxShadow: "0 4px 20px rgba(192,32,10,0.15)",
        }}>
          {links.map((l) => (
            <a key={l.href} href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 20px", textDecoration: "none",
                fontSize: 15, color: "#1a1a18",
                borderBottom: "0.5px solid #f1efe8",
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{l.icon}</span>
              <span>{l.label}</span>
              {l.href.startsWith("http") && <span style={{ marginLeft: "auto", fontSize: 12, color: "#C0200A" }}>↗</span>}
            </a>
          ))}
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { background: #FBF8F5; }
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; }
          .nav-label { display: none !important; }
        }
        @media (min-width: 641px) {
          .nav-label { display: inline !important; }
        }
      `}</style>
    </>
  );
}