"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "soldryck_onboarding_v1";

interface Step {
  emoji: string;
  title: string;
  body: string;
  spot: React.CSSProperties;
  spotRadius: string;
  card: React.CSSProperties;
  arrowDir: "up" | "down" | "right";
}

const STEPS: Step[] = [
  {
    emoji: "🟠",
    title: "Orange = sol · Grå = skugga",
    body: "Varje prick är en uteservering. Orange prickar har sol just nu — grå prickar har skugga.",
    spot: { left: "5%", top: "25%", width: "90%", height: "32%" },
    spotRadius: "20px",
    card: { top: "60%", left: "50%", transform: "translateX(-50%)", width: "290px" },
    arrowDir: "up",
  },
  {
    emoji: "🕐",
    title: "Bläddra timme för timme",
    body: "Dra i tidsreglaget för att se vilka ställen som har sol vid olika tider på dagen.",
    spot: { left: "3%", bottom: "0", width: "94%", height: "205px" },
    spotRadius: "16px 16px 0 0",
    card: { bottom: "220px", left: "50%", transform: "translateX(-50%)", width: "290px" },
    arrowDir: "down",
  },
  {
    emoji: "🍽️",
    title: "Filtrera typ av ställe",
    body: "Tryck på Mat, Café, Bar eller Takbar för att filtrera. Välj flera, eller tryck igen för att återställa.",
    spot: { left: "50%", top: "58px", transform: "translateX(-50%)", width: "246px", height: "52px" },
    spotRadius: "16px",
    card: { top: "122px", left: "50%", transform: "translateX(-50%)", width: "290px" },
    arrowDir: "up",
  },
  {
    emoji: "📍",
    title: "GPS och närmaste sol",
    body: "GPS-knappen visar din plats. Solfläcksknappen flyger dig direkt till närmaste uteservering med sol.",
    spot: { right: "4px", bottom: "218px", width: "52px", height: "112px" },
    spotRadius: "26px",
    card: { bottom: "256px", right: "68px", width: "230px" },
    arrowDir: "right",
  },
];

export default function Onboarding({ ready }: { ready: boolean }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);

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
      {/* Spotlight cutout — box-shadow dims everything outside */}
      <div
        key={`spot-${step}`}
        style={{
          position: "fixed",
          ...s.spot,
          borderRadius: s.spotRadius,
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.52)",
          border: "2px solid rgba(251,146,60,0.75)",
          zIndex: 1,
          pointerEvents: "none",
          animation: "onb-pulse 2.2s ease-in-out infinite",
        }}
      />

      {/* Card — outer div positions, inner div animates (avoids transform conflict) */}
      <div
        key={`card-${step}`}
        style={{ position: "fixed", ...s.card, zIndex: 2, pointerEvents: "all" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: "relative", animation: "onb-enter 0.22s ease-out both" }}>
          {/* Arrows pointing toward spotlight */}
          {s.arrowDir === "up" && (
            <div style={{
              position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
              borderBottom: "9px solid rgba(255,255,255,0.82)",
            }} />
          )}
          {s.arrowDir === "down" && (
            <div style={{
              position: "absolute", bottom: -9, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
              borderTop: "9px solid rgba(255,255,255,0.82)",
            }} />
          )}
          {s.arrowDir === "right" && (
            <div style={{
              position: "absolute", right: -9, top: "50%", transform: "translateY(-50%)",
              width: 0, height: 0,
              borderTop: "9px solid transparent", borderBottom: "9px solid transparent",
              borderLeft: "9px solid rgba(255,255,255,0.82)",
            }} />
          )}

          {/* Glass card */}
          <div style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "0.5px solid rgba(255,255,255,0.7)",
            borderRadius: 20,
            boxShadow: "0 6px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
            padding: "18px 20px 16px",
          }}>
            <div style={{ fontSize: 26, marginBottom: 8, lineHeight: 1 }}>{s.emoji}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 6, lineHeight: 1.3 }}>
              {s.title}
            </div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, marginBottom: 16 }}>
              {s.body}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Step dots */}
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
