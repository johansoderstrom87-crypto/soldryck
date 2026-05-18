"use client";

import { useEffect, useState } from "react";

interface VenuesLoadingPillProps {
  /** Becomes false the moment the venues-computed module resolves. */
  loading: boolean;
}

/**
 * While the ~6 MB venues-computed module downloads + parses, the map shows
 * just the 8 mock-fallback venues — looks like a broken app. This pill
 * provides ambient feedback at the top of the screen so the user knows
 * something is on the way. Fades out 300 ms after loading completes so the
 * map isn't permanently cluttered.
 */
export default function VenuesLoadingPill({ loading }: VenuesLoadingPillProps) {
  const [visible, setVisible] = useState(false);

  // Only show after a short delay (don't flash on fast connections).
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(t);
  }, [loading]);

  // Fade out after loading completes.
  useEffect(() => {
    if (loading) return;
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [loading, visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(160px + var(--safe-top, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1085,
        pointerEvents: "none",
        padding: "5px 14px 5px 11px",
        borderRadius: "var(--r-full, 999px)",
        background: "rgba(255,255,255,0.85)",
        border: "0.5px solid rgba(255,255,255,0.7)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        fontSize: 11,
        fontWeight: 600,
        color: "#475569",
        opacity: loading ? 1 : 0,
        transition: "opacity 0.3s ease",
        animation: loading ? "venues-pill-in 0.3s ease-out" : undefined,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
        <path d="M12 3a9 9 0 0 1 9 9" />
      </svg>
      Laddar uteserveringar…
      <style>{`
        @keyframes venues-pill-in {
          from { opacity: 0; transform: translate(-50%, -4px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
