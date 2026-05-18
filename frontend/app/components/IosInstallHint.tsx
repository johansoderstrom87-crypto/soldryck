"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "soldryck_ios_install_dismissed_v1";

/**
 * iOS Safari doesn't fire `beforeinstallprompt`, so the existing "Installera
 * appen"-knapp in the settings menu is silently absent for the entire iOS
 * audience. We surface a one-time bottom-sheet hint with the manual
 * "Dela → Lägg till på hemskärmen" instructions instead.
 *
 * Shown only when ALL of the following are true:
 *  - User-agent is iOS Safari
 *  - Not already running standalone (i.e. not installed)
 *  - User has not dismissed the hint before (localStorage)
 *  - User has been on the page > 15 s (don't compete with onboarding)
 */
export default function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    // Safari only — Chrome/Firefox iOS share the WebKit core but can't
    // install PWAs to home screen on iOS, so the hint would be misleading.
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (!isIOS || !isSafari) return;

    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return;

    const t = setTimeout(() => setVisible(true), 15_000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  return (
    <div
      style={{
        // Anchored above the time slider (slider is ~218 px tall + safe inset).
        // Anchoring high enough that the slider's gradient handle doesn't peek
        // under the hint, and centered + max-width for tablets / landscape.
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(232px + var(--safe-bottom, 0px))",
        zIndex: 1300,
        maxWidth: 420,
        margin: "0 auto",
        pointerEvents: "auto",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        animation: "ios-install-in 0.4s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 14,
          borderRadius: 18,
          background: "rgba(255,255,255,0.96)",
          border: "0.5px solid rgba(255,255,255,0.8)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        {/* App icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "linear-gradient(160deg, #fb923c 0%, #f59e0b 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(245,158,11,0.35)",
          }}
          aria-hidden
        >
          ☀️
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }}>
            Lägg Soldryck på hemskärmen
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.4 }}>
            Tryck{" "}
            <span style={{ display: "inline-flex", verticalAlign: "middle", margin: "0 2px" }}>
              <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                <path d="M7 11V2M7 2L3.5 5.5M7 2l3.5 3.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 8v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <strong style={{ color: "#0f172a" }}>Dela</strong>
            {" "}och välj{" "}
            <strong style={{ color: "#0f172a" }}>Lägg till på hemskärmen</strong>.
          </div>
        </div>

        <button
          onClick={dismiss}
          aria-label="Stäng"
          style={{
            flexShrink: 0,
            width: 28, height: 28,
            border: "none",
            background: "rgba(15,23,42,0.05)",
            color: "#64748b",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes ios-install-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
