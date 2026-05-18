import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sidan kunde inte hittas — Soldryck",
};

export default function NotFound() {
  return (
    <main
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(28px + var(--safe-top, 0px)) 22px calc(40px + var(--safe-bottom, 0px))",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        background: "linear-gradient(180deg, #fff7ed 0%, #fffbeb 280px, #fff 600px)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        {/* Big sun-with-clouds glyph — same family as the empty states elsewhere */}
        <div
          aria-hidden
          style={{
            fontSize: 84,
            lineHeight: 1,
            marginBottom: 18,
            filter: "drop-shadow(0 8px 24px rgba(245,158,11,0.25))",
          }}
        >
          🌥️
        </div>

        <div
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 999,
            background: "rgba(245,158,11,0.12)",
            color: "#b45309",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          404 — Lite skugga här
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a", marginBottom: 10 }}>
          Här hittar vi ingen sol
        </h1>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 24 }}>
          Sidan finns inte (eller har flyttat). Inga problem — kartan väntar
          fortfarande på dig.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            background: "linear-gradient(135deg, #fb923c, #f59e0b)",
            color: "#fff",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 6px 20px rgba(245,158,11,0.4)",
          }}
        >
          ☀️ Tillbaka till kartan
        </Link>
      </div>
    </main>
  );
}
