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
          transform: phase === "in" ? "scale(0.82) translateY(12px)" : "scale(1) translateY(0)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 0.45s cubic-bezier(0.34,1.4,0.64,1), opacity 0.35s ease-out",
        }}
      >
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
  );
}
