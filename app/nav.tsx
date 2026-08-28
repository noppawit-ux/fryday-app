"use client";

import { useState } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/",         icon: "🏠", label: "หน้าหลัก" },
    { href: "/tasks",    icon: "📋", label: "งาน" },
    { href: "https://fryday-accounting-dashboard.vercel.app", icon: "💰", label: "การเงิน" },
    { href: "/marketing",icon: "📣", label: "Marketing" },
    { href: "/calendar", icon: "🗓", label: "ปฏิทิน" },
    { href: "/files",    icon: "📁", label: "ไฟล์งาน" },
  ];

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 56, background: "#fff", borderBottom: "0.5px solid #e5e3db",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 4,
      }}>
        {/* Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: 8 }}>
          <span style={{ fontSize: 22 }}>🍗</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a18", letterSpacing: "-0.02em" }}>Fryday</span>
        </a>

        {/* Desktop Links */}
        <div style={{ display: "flex", gap: 2, flex: 1 }} className="desktop-nav">
          {links.slice(1).map((l) => (
            <a key={l.href} href={l.href} style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 13, color: "#73726c", textDecoration: "none",
              padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f6f5f0"; e.currentTarget.style.color = "#1a1a18"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#73726c"; }}
            >
              <span>{l.icon}</span>
              <span style={{ display: "none" }} className="nav-label">{l.label}</span>
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
              background: ["#E6F1FB","#EAF3DE","#FAEEDA"][i],
              color: ["#185FA5","#27500A","#854F0B"][i],
              border: `1.5px solid ${["#B5D4F4","#C0DD97","#FAC775"][i]}`,
            }}>{p}</div>
          ))}
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: "none", background: "none", border: "none",
            fontSize: 22, cursor: "pointer", padding: "4px 8px",
            color: "#1a1a18", marginLeft: 4,
          }}
          className="hamburger"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 56, left: 0, right: 0, zIndex: 199,
          background: "#fff", borderBottom: "0.5px solid #e5e3db",
          padding: "8px 0", boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}>
          {links.map((l) => (
            <a key={l.href} href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 20px", textDecoration: "none",
                fontSize: 15, color: "#1a1a18", borderBottom: "0.5px solid #f1efe8",
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{l.icon}</span>
              <span>{l.label}</span>
            </a>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; }
        }
        @media (min-width: 641px) {
          .nav-label { display: inline !important; }
        }
      `}</style>
    </>
  );
}