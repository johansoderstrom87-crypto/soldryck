"use client";
import { useState, useEffect, useCallback, useLayoutEffect } from "react";

const STORAGE_KEY = "soldryck_onboarding_v1";

interface Bullet { color: string; border?: string; text: string; }

/**
 * Onboarding spotlights used to be hard-coded pixel coordinates ("top: 78px,
 * bottom: 220px"), which broke on small phones (iPhone SE) and large phones
 * (Pro Max) and ignored the safe-area insets entirely. Now each step (except
 * the intro) names a `target` data attribute, and we measure its bounding
 * rect at runtime so the spotlight aligns with the actual element regardless
 * of viewport size, orientation, or notch height.
 */
interface Step {
  emoji: string;
  shineSun?: boolean;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: Bullet[];
  /** `data-onboarding="..."` attribute on the element to highlight. */
  target?: string;
  /** Extra px of breathing room around the target. */
  targetPadding?: number;
  /** Corner radius for the spotlight cutout. */
  spotRadius: string;
  /** Where the card sits relative to the spot. */
  arrowDir: "up" | "down" | "right";
  /** Card width — kept stable per step so copy lines don't reflow. */
  cardWidth: number;
  /** Used only when `target` is absent (intro step). */
  fallbackSpot?: React.CSSProperties;
  fallbackCard?: React.CSSProperties;
}

const STEPS: Step[] = [
  {
    emoji: "☀️",
    shineSun: true,
    title: "Välkommen till Soldryck!",
    subtitle: "Hitta enkelt var uteserveringarna med sol finns i Stockholm.",
    bullets: [
      { color: "#f59e0b", text: "Uteservering med sol just nu" },
      { color: "#94a3b8", text: "Uteservering med skugga just nu" },
      { color: "#e2e8f0", border: "#cbd5e1", text: "Ställen som eventuellt inte har uteservering" },
    ],
    spotRadius: "20px",
    arrowDir: "up",
    cardWidth: 300,
    fallbackSpot: { left: "5%", top: "25%", width: "90%", height: "32%" },
    fallbackCard: { top: "60%", left: "50%", transform: "translateX(-50%)", width: "300px" },
  },
  {
    emoji: "🕐",
    title: "Bläddra timme för timme",
    body: "Dra i tidsreglaget för att se vilka ställen som har sol vid olika tider på dagen. Du kan också följa väderprognosten timme för timme.",
    target: "time-slider",
    targetPadding: 8,
    spotRadius: "20px",
    arrowDir: "down",
    cardWidth: 290,
  },
  {
    emoji: "🍽️",
    title: "Filtrera typ av ställe",
    body: "Tryck på Mat, Café, Bar eller Takbar för att filtrera. Välj flera, eller tryck igen för att återställa.",
    target: "filter-row",
    targetPadding: 6,
    spotRadius: "14px",
    arrowDir: "up",
    cardWidth: 290,
  },
  {
    emoji: "📍",
    title: "GPS och närmaste sol",
    body: "GPS-knappen visar din plats. Solfläcksknappen flyger dig direkt till närmaste uteservering med sol.",
    target: "locate-btn",
    targetPadding: 8,
    spotRadius: "26px",
    arrowDir: "right",
    cardWidth: 228,
  },
];

/**
 * Union of bounding rects across every element with the given data attribute,
 * plus padding. Returns null if no elements match (e.g. UI not mounted yet).
 */
function measureTarget(target: string, padding: number): { x: number; y: number; w: number; h: number } | null {
  if (typeof document === "undefined") return null;
  const els = document.querySelectorAll(`[data-onboarding="${target}"]`);
  if (els.length === 0) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  els.forEach((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  if (!isFinite(left)) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  const w = Math.min(vw, right + padding) - x;
  const h = Math.min(vh, bottom + padding) - y;
  return { x, y, w, h };
}

/** Place the card relative to the spot in viewport-fixed coords. */
function placeCard(
  spot: { x: number; y: number; w: number; h: number },
  arrowDir: "up" | "down" | "right",
  cardWidth: number,
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 10;
  const gap = 12;

  if (arrowDir === "up") {
    // Card below spot, horizontally centered
    const left = Math.max(margin, Math.min(vw - cardWidth - margin, spot.x + spot.w / 2 - cardWidth / 2));
    return { top: spot.y + spot.h + gap, left, width: cardWidth };
  }
  if (arrowDir === "down") {
    // Card above spot
    const left = Math.max(margin, Math.min(vw - cardWidth - margin, spot.x + spot.w / 2 - cardWidth / 2));
    return { bottom: vh - spot.y + gap, left, width: cardWidth };
  }
  // right: card to the left of the spot
  const right = vw - spot.x + gap;
  // Vertically center on spot, clamp
  const idealTop = spot.y + spot.h / 2 - 80;
  const top = Math.max(margin, Math.min(vh - 200 - margin, idealTop));
  return { top, right, width: cardWidth };
}

export default function Onboarding({ ready }: { ready: boolean }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [spotStyle, setSpotStyle] = useState<React.CSSProperties | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);

  // Recompute spot+card whenever the visible step changes, on resize, on
  // orientation change, or after a short delay (to catch elements that mount
  // a tick after onboarding becomes visible — e.g. the time slider track).
  useLayoutEffect(() => {
    if (!visible) return;
    const s = STEPS[step];

    function recompute() {
      if (!s.target) {
        setSpotStyle(s.fallbackSpot ?? null);
        setCardStyle(s.fallbackCard ?? null);
        return;
      }
      const rect = measureTarget(s.target, s.targetPadding ?? 6);
      if (!rect) {
        // Target not mounted yet — try again shortly
        return;
      }
      setSpotStyle({
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      });
      setCardStyle(placeCard(rect, s.arrowDir, s.cardWidth));
    }

    recompute();
    // Retry a few times in case the target mounts late (e.g. dynamic imports)
    const r1 = setTimeout(recompute, 60);
    const r2 = setTimeout(recompute, 250);
    const r3 = setTimeout(recompute, 800);

    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    return () => {
      clearTimeout(r1); clearTimeout(r2); clearTimeout(r3);
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
    };
  }, [step, visible]);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }, 300);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  }, [step, dismiss]);

  if (!visible) return null;

  const s = STEPS[step];

  // If we don't have a computed spot/card yet (target not mounted), wait
  // one frame rather than flashing a misplaced spotlight.
  if (!spotStyle || !cardStyle) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        pointerEvents: "all",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s ease",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
      }}
      onClick={next}
    >
      {/* Spotlight cutout */}
      <div
        key={`spot-${step}`}
        style={{
          position: "fixed",
          ...spotStyle,
          borderRadius: s.spotRadius,
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.52)",
          border: "2px solid rgba(251,146,60,0.8)",
          zIndex: 1,
          pointerEvents: "none",
          animation: "onb-pulse 2.2s ease-in-out infinite",
          transition: "left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease",
        }}
      />

      {/* Card — outer positions, inner animates */}
      <div
        key={`card-${step}`}
        style={{ position: "fixed", ...cardStyle, zIndex: 2, pointerEvents: "all" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: "relative", animation: "onb-enter 0.22s ease-out both" }}>
          {s.arrowDir === "up" && (
            <div style={{
              position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
              borderBottom: "9px solid rgba(255,255,255,0.85)",
            }} />
          )}
          {s.arrowDir === "down" && (
            <div style={{
              position: "absolute", bottom: -9, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
              borderTop: "9px solid rgba(255,255,255,0.85)",
            }} />
          )}
          {s.arrowDir === "right" && (
            <div style={{
              position: "absolute", right: -9, top: "50%", transform: "translateY(-50%)",
              width: 0, height: 0,
              borderTop: "9px solid transparent", borderBottom: "9px solid transparent",
              borderLeft: "9px solid rgba(255,255,255,0.85)",
            }} />
          )}

          <div style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "0.5px solid rgba(255,255,255,0.7)",
            borderRadius: 20,
            boxShadow: "0 6px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
            padding: "18px 20px 16px",
          }}>
            {/* Emoji / icon */}
            <div style={{
              fontSize: 28,
              marginBottom: 8,
              lineHeight: 1,
              display: "inline-block",
              animation: s.shineSun ? "onb-sun 8s linear infinite" : undefined,
            }}>
              {s.emoji}
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: s.subtitle ? 4 : 6, lineHeight: 1.3 }}>
              {s.title}
            </div>

            {s.subtitle && (
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 12 }}>
                {s.subtitle}
              </div>
            )}

            {s.bullets && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {s.bullets.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                      background: b.color,
                      border: `2px solid ${b.border ?? "#fff"}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }} />
                    <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{b.text}</span>
                  </div>
                ))}
              </div>
            )}

            {s.body && (
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, marginBottom: 16 }}>
                {s.body}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: s.bullets ? 0 : undefined }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === step ? "#f59e0b" : "rgba(0,0,0,0.14)",
                    transition: "all 0.25s ease",
                  }} />
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {step < STEPS.length - 1 && (
                  <button
                    onClick={dismiss}
                    style={{
                      background: "none", border: "none",
                      fontSize: 12, color: "#94a3b8",
                      cursor: "pointer", padding: "4px 0",
                      fontFamily: "inherit",
                    }}
                  >
                    Hoppa över
                  </button>
                )}
                <button
                  onClick={next}
                  style={{
                    background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                    border: "none", borderRadius: 999,
                    padding: "8px 18px",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(245,158,11,0.45)",
                    fontFamily: "inherit",
                  }}
                >
                  {step < STEPS.length - 1 ? "Nästa →" : "Klar!"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
