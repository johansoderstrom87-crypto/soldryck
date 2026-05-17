"use client";

import { useEffect, useState } from "react";
import { formatShortDate } from "../lib/season";

interface OffSeasonBannerProps {
  /** The in-season date the app has snapped forward to. */
  snappedDate: Date;
}

const STORAGE_KEY = "soldryck_offseason_dismissed_v1";

/**
 * Shown only when the real-world date is outside April–October.
 * Explains why the app's sun data jumps forward, dismissable per session.
 */
export default function OffSeasonBanner({ snappedDate }: OffSeasonBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    // Delay so it doesn't compete with splash/onboarding on first paint
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(158px + var(--safe-top, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1080,
        maxWidth: "calc(100vw - 24px)",
        pointerEvents: "auto",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        animation: "offseason-in 0.35s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px 8px 14px",
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(255,247,237,0.95) 0%, rgba(254,243,199,0.95) 100%)",
          border: "0.5px solid rgba(245,158,11,0.4)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(245,158,11,0.18)",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>☀️</span>
        <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.35, flex: 1, minWidth: 0 }}>
          <strong style={{ fontWeight: 700 }}>Utanför säsongen.</strong>{" "}
          Soldryck räknar sol april–oktober. Visar prognos för{" "}
          <strong style={{ fontWeight: 700 }}>{formatShortDate(snappedDate)}</strong>.
        </div>
        <button
          onClick={dismiss}
          aria-label="Stäng meddelande"
          style={{
            flexShrink: 0,
            width: 24, height: 24,
            border: "none", background: "transparent",
            color: "#92400e", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes offseason-in {
          from { opacity: 0; transform: translate(-50%, -6px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
