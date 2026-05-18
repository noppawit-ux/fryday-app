"use client";

export default function Nav() {
  const links = [
    { href: "/tasks",     icon: "📋", label: "งาน" },
    { href: "/finance",   icon: "💰", label: "การเงิน" },
    { href: "/marketing", icon: "📣", label: "Marketing" },
    { href: "/calendar",  icon: "🗓", label: "ปฏิทิน" },
    { href: "/files",     icon: "📁", label: "ไฟล์งาน" },
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      height: 56, background: "#fff", borderBottom: "0.5px solid #e5e3db",
      display: "flex", alignItems: "center", padding: "0 20px", gap: 4,
    }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: 16 }}>
        <span style={{ fontSize: 22 }}>🍗</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a18" }}>Fryday</span>
      </a>

      {links.map((l) => (
        <a key={l.href} href={l.href} style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 13, color: "#73726c", textDecoration: "none",
          padding: "6px 12px", borderRadius: 8,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f6f5f0"; e.currentTarget.style.color = "#1a1a18"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#73726c"; }}
        >
          <span style={{ fontSize: 15 }}>{l.icon}</span>
          <span>{l.label}</span>
        </a>
      ))}

      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        {["A","B","C"].map((p, i) => (
          <div key={p} style={{
            width: 30, height: 30, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600,
            background: ["#E6F1FB","#EAF3DE","#FAEEDA"][i],
            color: ["#185FA5","#27500A","#854F0B"][i],
            border: `1.5px solid ${["#B5D4F4","#C0DD97","#FAC775"][i]}`,
          }}>
            {p}
          </div>
        ))}
      </div>
    </nav>
  );
}