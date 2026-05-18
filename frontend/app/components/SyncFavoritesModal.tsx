"use client";

import { useEffect, useState } from "react";
import { getSyncCode, pushFavoritesToCloud, pullFavoritesFromCloud } from "../lib/favorites";

interface SyncFavoritesModalProps {
  onClose: () => void;
}

/**
 * Short-code based, anonymous favorite sync. The user generates a code on
 * one device, pushes the favorite list to it, then types the code on
 * another device to pull the same list. No accounts, no email, no PII.
 *
 * Design intentionally minimal — two big actions ("Min kod" / "Hämta från
 * kod"), each with one line of explanation. Codes are 6 chars from an
 * unambiguous alphabet (no 0/1/O/I/L), so they're easy to read out loud.
 */
export default function SyncFavoritesModal({ onClose }: SyncFavoritesModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [pullStatus, setPullStatus] = useState<"idle" | "ok" | "notfound" | "error">("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(getSyncCode());
  }, []);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function generate() {
    setPushing(true);
    const c = await pushFavoritesToCloud();
    setPushing(false);
    if (c) setCode(c);
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fall through silently */ }
  }

  async function pull() {
    const clean = inputCode.toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (clean.length !== 6) { setPullStatus("error"); return; }
    setPulling(true);
    const ok = await pullFavoritesFromCloud(clean);
    setPulling(false);
    if (ok) {
      setPullStatus("ok");
      setCode(clean);
      setInputCode("");
      setTimeout(() => { setPullStatus("idle"); onClose(); }, 1200);
    } else {
      setPullStatus("notfound");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Synka favoriter mellan enheter"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(16px + var(--safe-top, 0px)) 16px calc(16px + var(--safe-bottom, 0px))",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 22,
          padding: "20px 22px 18px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
              Synka favoriter
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
              Anonym kod på 6 tecken. Vi sparar bara id-listan — inget om dig.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Stäng"
            style={{
              width: 28, height: 28, border: "none",
              background: "rgba(15,23,42,0.05)",
              borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#64748b", flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="11" y2="11" />
              <line x1="11" y1="3" x2="3" y2="11" />
            </svg>
          </button>
        </div>

        {/* Push side */}
        <section style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
            Din kod
          </div>
          {code ? (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px",
                background: "linear-gradient(135deg, #fef3c7, #fed7aa)",
                borderRadius: 14,
                border: "0.5px solid rgba(251,146,60,0.35)",
              }}
            >
              <div style={{
                fontSize: 22, fontWeight: 800, letterSpacing: "0.18em",
                color: "#7c2d12", fontFamily: "var(--font-inter), monospace",
                flex: 1,
              }}>
                {code}
              </div>
              <button
                onClick={copyCode}
                aria-label="Kopiera koden"
                style={{
                  padding: "6px 12px",
                  background: "#fff",
                  border: "0.5px solid rgba(251,146,60,0.5)",
                  borderRadius: 10,
                  fontSize: 12, fontWeight: 600, color: "#7c2d12",
                  cursor: "pointer",
                }}
              >
                {copied ? "Kopierad!" : "Kopiera"}
              </button>
            </div>
          ) : (
            <button
              onClick={generate}
              disabled={pushing}
              style={{
                width: "100%", padding: "10px 14px",
                background: "linear-gradient(135deg, #fb923c, #f59e0b)",
                border: "none", borderRadius: 12,
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: pushing ? "wait" : "pointer",
                opacity: pushing ? 0.7 : 1,
              }}
            >
              {pushing ? "Skapar kod…" : "Skapa kod för dina favoriter"}
            </button>
          )}
          {code && (
            <button
              onClick={generate}
              disabled={pushing}
              style={{
                marginTop: 8,
                width: "100%", padding: "8px 14px",
                background: "transparent", border: "none",
                color: "#64748b", fontSize: 11,
                cursor: pushing ? "wait" : "pointer",
                textDecoration: "underline", textUnderlineOffset: 2,
              }}
            >
              {pushing ? "Uppdaterar…" : "Uppdatera molnet med min senaste lista"}
            </button>
          )}
        </section>

        <div style={{ height: 1, background: "rgba(15,23,42,0.08)", margin: "0 -22px 18px" }} />

        {/* Pull side */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
            Hämta från en annan enhet
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => { setInputCode(e.target.value.toUpperCase()); setPullStatus("idle"); }}
              onKeyDown={(e) => { if (e.key === "Enter") pull(); }}
              placeholder="ABC123"
              maxLength={6}
              aria-label="Synkkod"
              style={{
                flex: 1, padding: "10px 12px",
                background: "#f8fafc",
                border: pullStatus === "error" || pullStatus === "notfound"
                  ? "1px solid #ef4444"
                  : "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 16, fontWeight: 700, letterSpacing: "0.18em",
                fontFamily: "var(--font-inter), monospace",
                color: "#0f172a",
                outline: "none",
                textTransform: "uppercase",
              }}
            />
            <button
              onClick={pull}
              disabled={pulling || inputCode.length !== 6}
              style={{
                padding: "10px 16px",
                background: "#0f172a", border: "none", borderRadius: 10,
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: pulling || inputCode.length !== 6 ? "not-allowed" : "pointer",
                opacity: pulling || inputCode.length !== 6 ? 0.4 : 1,
              }}
            >
              {pulling ? "…" : "Hämta"}
            </button>
          </div>
          {pullStatus === "ok" && (
            <div style={{ fontSize: 12, color: "#15803d", marginTop: 6 }}>✓ Favoriter inlästa</div>
          )}
          {pullStatus === "notfound" && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>Koden hittades inte — dubbelkolla att den är rätt.</div>
          )}
          {pullStatus === "error" && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>Koden ska vara 6 tecken (A-Z, 2-9).</div>
          )}
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 10, lineHeight: 1.4 }}>
            Hämtning <strong>ersätter</strong> dina lokala favoriter — så spara
            dem med en egen kod först om du vill behålla båda.
          </p>
        </section>
      </div>
    </div>
  );
}
