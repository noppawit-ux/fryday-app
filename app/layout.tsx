import type { Metadata } from "next";
import Nav from "./nav";

export const metadata: Metadata = {
  title: "Fryday — ระบบบริหารร้าน",
  description: "ระบบจัดการร้านไก่ทอด Fryday",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, background: "#f6f5f0", fontFamily: "sans-serif" }}>
        <Nav />
        <div style={{ paddingTop: 56 }}>{children}</div>
      </body>
    </html>
  );
}