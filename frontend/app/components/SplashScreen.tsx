"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SESSION_KEY = "soldryck_splash_seen";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    // Returning visitors (within the same session) get a short 600 ms flash
    // so the logo still anchors the brand without delaying interactivity.
    // First-time visitors see the full 2.4 s reveal.
    let returning = false;
    try {
      returning = sessionStorage.getItem(SESSION_KEY) === "1";
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}

    const inMs   = returning ? 120 : 400;
    const outMs  = returning ? 420 : 1800;
    const doneMs = returning ? 600 : 2400;

    const t1 = setTimeout(() => setPhase("hold"), inMs);
    const t2 = setTimeout(() => setPhase("out"), outMs);
    const t3 = setTimeout(() => onDone(), doneMs);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #fff7ed 0%, #fef3c7 50%, #fff 100%)",
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 0.55s ease-in" : "opacity 0.35s ease-out",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      <div
        style={{
          position: "relative",
          transform: phase === "in" ? "scale(0.82) translateY(12px)" : "scale(1) translateY(0)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 0.45s cubic-bezier(0.34,1.4,0.64,1), opacity 0.35s ease-out",
        }}
      >
        {/* Pulsing sun rays behind the logo. Two phase-shifted rings so the
            pulse feels continuous rather than ticking on/off. */}
        <svg
          aria-hidden
          viewBox="-150 -150 300 300"
          width="340"
          height="340"
          style={{
            position: "absolute",
            inset: "50% 0 0 50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            opacity: phase === "hold" ? 0.55 : 0.25,
            transition: "opacity 0.6s ease-out",
            zIndex: 0,
          }}
        >
          {/* Ray group A — fade out as they expand */}
          <g style={{ animation: "splash-rays-a 2.6s ease-out infinite" }}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI * 2) / 12;
              return (
                <line
                  key={`a-${i}`}
                  x1={Math.cos(a) * 95}
                  y1={Math.sin(a) * 95}
                  x2={Math.cos(a) * 135}
                  y2={Math.sin(a) * 135}
                  stroke="#fbbf24"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
          {/* Ray group B — offset by 1.3 s, slimmer and outermost */}
          <g style={{ animation: "splash-rays-b 2.6s ease-out 1.3s infinite" }}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI * 2) / 12 + Math.PI / 12;
              return (
                <line
                  key={`b-${i}`}
                  x1={Math.cos(a) * 105}
                  y1={Math.sin(a) * 105}
                  x2={Math.cos(a) * 130}
                  y2={Math.sin(a) * 130}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        </svg>

        <div style={{ position: "relative", zIndex: 1 }}>
          <Image
            src="/logo.png"
            alt="Soldryck"
            width={220}
            height={260}
            priority
            style={{ objectFit: "contain", filter: "drop-shadow(0 8px 24px rgba(245,158,11,0.25))" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-rays-a {
          0%   { transform: scale(0.85); opacity: 0;   }
          25%  { transform: scale(1);    opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0;   }
        }
        @keyframes splash-rays-b {
          0%   { transform: scale(0.92); opacity: 0;   }
          30%  { transform: scale(1.05); opacity: 0.7; }
          100% { transform: scale(1.4);  opacity: 0;   }
        }
        @media (prefers-reduced-motion: reduce) {
          svg[aria-hidden] g { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
