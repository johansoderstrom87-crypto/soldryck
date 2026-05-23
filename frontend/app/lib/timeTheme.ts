/**
 * Time-of-day theme. Beräknar en sammanhängande "mood" baserat på vald
 * timme och datum (via dagens soluppgång/solnedgång). Resultatet driver
 * både kartans tonade overlay och CSS-variabler för chrome (Header-card,
 * TimeSlider, WeatherBar) så hela UI:t glider mellan dagsljus → gyllene
 * timme → skymning → dark mode när användaren scrubbar tidslinjen.
 *
 * Faserna är anchorade kring sunrise/sunset, inte absolut klocktid, så
 * det funkar både för april (sunset ~20:00) och juni (sunset ~22:00).
 */

export type ThemePhase =
  | "deep-night"
  | "dawn"
  | "morning-glow"
  | "day"
  | "afternoon-glow"
  | "golden"
  | "dusk"
  | "night";

export interface TimeTheme {
  phase: ThemePhase;
  isDark: boolean;
  /** Färgat överläggslager ovanpå kartan. a=0 = neutralt. */
  mapOverlay: { r: number; g: number; b: number; a: number };
  /** Bakgrund för glas-paneler (Header / TimeSlider / WeatherBar). */
  surfaceBg: string;
  surfaceBorder: string;
  surfaceShadow: string;
  textPrimary: string;
  textMuted: string;
}

function getSunTimes(date: Date, lat = 59.33, lng = 18.07) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 0.4093 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const cosH = -Math.tan((lat * Math.PI) / 180) * Math.tan(decl);
  if (cosH >= 1) return { sunrise: 12, sunset: 12 };
  if (cosH <= -1) return { sunrise: 0, sunset: 24 };
  const H = (Math.acos(cosH) * 180) / Math.PI;
  const hours = H / 15;
  const solarNoon = 12 - lng / 15 + 2; // CEST
  return { sunrise: solarNoon - hours, sunset: solarNoon + hours };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function getTimeTheme(hour: number, date: Date): TimeTheme {
  const { sunrise, sunset } = getSunTimes(date);
  const dtSr = hour - sunrise;
  const dtSs = hour - sunset;

  let phase: ThemePhase;
  if (dtSr < -1) phase = "deep-night";
  else if (dtSr < -0.25) phase = "dawn";
  else if (dtSr < 1.5) phase = "morning-glow";
  else if (dtSs < -1.5) phase = "day";
  else if (dtSs < -0.5) phase = "afternoon-glow";
  else if (dtSs < 0.5) phase = "golden";
  else if (dtSs < 1.5) phase = "dusk";
  else phase = "night";

  switch (phase) {
    case "deep-night":
    case "night":
      return {
        phase,
        isDark: true,
        // darkTiles tar över bakgrunden; en svag violett-glow lägger på sig.
        mapOverlay: { r: 30, g: 35, b: 80, a: 0.08 },
        surfaceBg: "rgba(22, 28, 56, 0.62)",
        surfaceBorder: "rgba(140, 150, 200, 0.32)",
        surfaceShadow: "0 6px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)",
        textPrimary: "#e2e8f0",
        textMuted: "#94a3b8",
      };

    case "dawn": {
      // Strax före soluppgången — kall blå-violett.
      const t = clamp01((dtSr + 1) / 0.75);
      return {
        phase,
        isDark: true,
        mapOverlay: { r: Math.round(100 + t * 60), g: Math.round(90 + t * 30), b: Math.round(160 - t * 20), a: 0.18 },
        surfaceBg: `rgba(${Math.round(55 + t * 20)}, ${Math.round(55 + t * 20)}, ${Math.round(110 - t * 10)}, 0.55)`,
        surfaceBorder: "rgba(180, 170, 220, 0.42)",
        surfaceShadow: "0 6px 24px rgba(40,30,70,0.4)",
        textPrimary: "#e2e8f0",
        textMuted: "#cbd5e1",
      };
    }

    case "morning-glow": {
      // Soluppgång → ljus dag. Varm rosa-amber fade ut.
      const t = clamp01(dtSr / 1.5);
      const alpha = 0.22 * (1 - t);
      return {
        phase,
        isDark: false,
        mapOverlay: { r: 255, g: Math.round(180 - t * 20), b: Math.round(130 + t * 40), a: alpha },
        surfaceBg: `rgba(255, ${Math.round(238 - t * 5)}, ${Math.round(225 + t * 25)}, ${0.38 - t * 0.10})`,
        surfaceBorder: `rgba(255, ${Math.round(215 - t * 10)}, ${Math.round(190 + t * 30)}, ${0.62 - t * 0.10})`,
        surfaceShadow: "0 6px 24px rgba(180,100,40,0.18), 0 2px 8px rgba(0,0,0,0.1)",
        textPrimary: "#1f1410",
        textMuted: "#7a5742",
      };
    }

    case "day":
      return {
        phase,
        isDark: false,
        mapOverlay: { r: 255, g: 255, b: 255, a: 0 },
        surfaceBg: "rgba(255, 255, 255, 0.30)",
        surfaceBorder: "rgba(255, 255, 255, 0.55)",
        surfaceShadow: "0 6px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
        textPrimary: "#0f172a",
        textMuted: "#64748b",
      };

    case "afternoon-glow": {
      // Mjuk amber-ramp in mot golden hour.
      const t = clamp01((dtSs + 1.5) / 1.0);
      const alpha = 0.06 + t * 0.10;
      return {
        phase,
        isDark: false,
        mapOverlay: { r: 255, g: Math.round(210 - t * 20), b: Math.round(140 - t * 30), a: alpha },
        surfaceBg: `rgba(255, ${Math.round(248 - t * 18)}, ${Math.round(235 - t * 35)}, ${0.32 + t * 0.06})`,
        surfaceBorder: `rgba(255, ${Math.round(232 - t * 12)}, ${Math.round(200 - t * 30)}, 0.62)`,
        surfaceShadow: "0 6px 24px rgba(180,110,40,0.22), 0 2px 8px rgba(0,0,0,0.10)",
        textPrimary: "#1f1410",
        textMuted: "#7a5742",
      };
    }

    case "golden": {
      // Peak: brännande amber/orange, glödande boxshadow.
      const t = clamp01((dtSs + 0.5) / 1.0);
      const alpha = 0.20 + t * 0.08;
      return {
        phase,
        isDark: false,
        mapOverlay: {
          r: 255,
          g: Math.round(160 - t * 30),
          b: Math.round(85 + t * 25),
          a: alpha,
        },
        surfaceBg: `rgba(255, ${Math.round(220 - t * 30)}, ${Math.round(170 - t * 40)}, ${0.42 + t * 0.05})`,
        surfaceBorder: `rgba(255, ${Math.round(195 - t * 25)}, ${Math.round(140 - t * 30)}, 0.72)`,
        surfaceShadow:
          "0 6px 24px rgba(200,90,30,0.32), 0 0 18px rgba(255,160,80,0.35), 0 2px 8px rgba(0,0,0,0.10)",
        textPrimary: "#1f1410",
        textMuted: "#7a4a2e",
      };
    }

    case "dusk": {
      // Övergång amber → violet → night.
      const t = clamp01((dtSs - 0.5) / 1.0);
      const alpha = 0.28 + t * 0.10;
      return {
        phase,
        isDark: true,
        mapOverlay: {
          r: Math.round(210 - t * 140),
          g: Math.round(120 - t * 70),
          b: Math.round(110 + t * 30),
          a: alpha,
        },
        surfaceBg: `rgba(${Math.round(85 - t * 60)}, ${Math.round(70 - t * 45)}, ${Math.round(125 - t * 65)}, ${0.55 + t * 0.08})`,
        surfaceBorder: `rgba(${Math.round(180 - t * 50)}, ${Math.round(160 - t * 30)}, ${Math.round(210 - t * 30)}, 0.45)`,
        surfaceShadow: "0 6px 24px rgba(30,20,60,0.4), 0 2px 8px rgba(0,0,0,0.18)",
        textPrimary: "#f1f5f9",
        textMuted: "#cbd5e1",
      };
    }
  }
}

/** Skriv tema till CSS-vars på `:root`. CSS-transitions sköter glidet. */
export function applyTimeTheme(theme: TimeTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const { r, g, b, a } = theme.mapOverlay;
  root.style.setProperty("--theme-map-overlay", `rgba(${r}, ${g}, ${b}, ${a})`);
  // Stäng av .map-ambient:s mix-blend-mode i dag-fas (alpha ≈ 0). Blandning
  // mot tile-pixlarna kostar GPU-fillrate per frame även när overlayens
  // alpha gör skillnaden mellan "med" och "utan" osynlig — under hela
  // arbetstiden då solen står högt får vi alltså tillbaka pan-FPS gratis.
  root.style.setProperty("--theme-map-overlay-blend", a < 0.02 ? "normal" : "multiply");
  root.style.setProperty("--theme-surface-bg", theme.surfaceBg);
  root.style.setProperty("--theme-surface-border", theme.surfaceBorder);
  root.style.setProperty("--theme-surface-shadow", theme.surfaceShadow);
  root.style.setProperty("--theme-text-primary", theme.textPrimary);
  root.style.setProperty("--theme-text-muted", theme.textMuted);
  root.dataset.themePhase = theme.phase;
  root.dataset.themeMode = theme.isDark ? "dark" : "light";
}
