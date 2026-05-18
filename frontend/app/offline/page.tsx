"use client";

import { useEffect, useState } from "react";

/**
 * Shown when the service worker can't fetch a page AND has no cached
 * version. Has a "Försök igen"-button that reloads when the browser
 * regains connectivity (auto via `online`-event, also clickable).
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      // Auto-reload once connectivity returns — the cached map and the live
      // venue JSON come back without the user thinking about it.
      window.location.reload();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <main
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(28px + var(--safe-top, 0px)) 22px calc(40px + var(--safe-bottom, 0px))",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 320px, #fff 700px)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div aria-hidden style={{ fontSize: 84, lineHeight: 1, marginBottom: 18 }}>
          ☁️
        </div>

        <div
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 999,
            background: online ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.15)",
            color: online ? "#15803d" : "#475569",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {online ? "Anslutningen är tillbaka" : "Du är offline"}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a", marginBottom: 10 }}>
          Solen tappar nätet ibland
        </h1>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 24 }}>
          Soldryck behöver internet för att hämta kartrutor, väder och
          venues-data. När anslutningen är tillbaka laddar vi om automatiskt.
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            background: "linear-gradient(135deg, #fb923c, #f59e0b)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(245,158,11,0.4)",
          }}
        >
          🔄 Försök igen
        </button>
      </div>
    </main>
  );
}
