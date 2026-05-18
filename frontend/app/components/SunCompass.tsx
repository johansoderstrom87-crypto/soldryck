"use client";

/**
 * Sun position compass — a small circular widget pinned in the bottom-left
 * of the map that shows where the sun is at the selected hour. Center of
 * the circle = directly overhead (elevation 90°), edge = horizon. Helps
 * users intuit which side of a building will be lit and which will be in
 * shade for the time they're scrubbing to.
 *
 * Compass orientation matches the map (north = up). The sun dot's screen
 * angle equals the solar azimuth, and its distance from center is inverse
 * to elevation so high-noon sits in the middle and dawn/dusk hugs the rim.
 */

import { useMemo } from "react";

const LAT = 59.33;
const LNG = 18.07;

function computeSunPosition(date: Date, hour: number): { azimuthDeg: number; elevationDeg: number } | null {
  const latRad = (LAT * Math.PI) / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const decl = 0.4093 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const solarNoon = 12 - LNG / 15 + 2; // CEST UTC+2 — same as the shadow pipeline
  const hourAngle = ((hour - solarNoon) * 15 * Math.PI) / 180;

  const sinElev =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
  const elevation = Math.asin(sinElev);
  if (elevation <= 0) return null; // sun below horizon → no point drawing

  const cosAz =
    (Math.sin(decl) - Math.sin(latRad) * sinElev) /
    (Math.cos(latRad) * Math.cos(elevation));
  let azimuth = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
  if (hourAngle > 0) azimuth = 360 - azimuth;

  return { azimuthDeg: azimuth, elevationDeg: (elevation * 180) / Math.PI };
}

interface SunCompassProps {
  hour: number;
  date: Date;
}

export default function SunCompass({ hour, date }: SunCompassProps) {
  const sun = useMemo(() => computeSunPosition(date, hour), [date, hour]);

  // Compass geometry: 60 px container, sun dot orbits a 22 px radius inside.
  const R = 22;
  const isNight = sun === null;
  const azimuthRad = sun ? (sun.azimuthDeg * Math.PI) / 180 : 0;
  // Higher elevation → closer to centre. r=0 at zenith, r=R at horizon.
  const elevR = sun ? ((90 - Math.min(90, sun.elevationDeg)) / 90) * R : 0;
  const sx = Math.sin(azimuthRad) * elevR;
  const sy = -Math.cos(azimuthRad) * elevR;

  return (
    <div
      role="img"
      aria-label={
        sun
          ? `Solposition kl ${hour}: ${Math.round(sun.azimuthDeg)}° azimut, ${Math.round(sun.elevationDeg)}° över horisonten`
          : `Klockan ${hour} är solen under horisonten`
      }
      style={{
        position: "fixed",
        bottom: "calc(232px + var(--safe-bottom, 0px))",
        left: "calc(12px + var(--safe-left, 0px))",
        zIndex: 1001,
        width: 60,
        height: 60,
        pointerEvents: "none",
        background: "rgba(255,255,255,0.3)",
        border: "0.5px solid rgba(255,255,255,0.55)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
      }}
    >
      <svg width="60" height="60" viewBox="-30 -30 60 60" aria-hidden>
        {/* Cardinal labels */}
        {[
          { l: "N", x: 0, y: -23 },
          { l: "E", x: 23, y: 3 },
          { l: "S", x: 0, y: 26 },
          { l: "W", x: -23, y: 3 },
        ].map((c) => (
          <text
            key={c.l}
            x={c.x}
            y={c.y}
            textAnchor="middle"
            style={{
              fontSize: 7,
              fontWeight: 700,
              fill: "rgba(15,23,42,0.6)",
              letterSpacing: "0.06em",
            }}
          >
            {c.l}
          </text>
        ))}
        {/* Inner faint ring at horizon radius */}
        <circle cx="0" cy="0" r={R} fill="none" stroke="rgba(15,23,42,0.18)" strokeWidth="0.5" />
        {/* Origin / zenith marker */}
        <circle cx="0" cy="0" r="1.5" fill="rgba(15,23,42,0.35)" />

        {sun && (
          <>
            {/* Direction line from centre to sun */}
            <line
              x1="0"
              y1="0"
              x2={sx}
              y2={sy}
              stroke="rgba(245,158,11,0.45)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {/* Sun glyph */}
            <g transform={`translate(${sx} ${sy})`}>
              <circle r="4" fill="url(#sun-grad)" />
              {/* Tiny rays */}
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 5}
                    y1={Math.sin(a) * 5}
                    x2={Math.cos(a) * 6.5}
                    y2={Math.sin(a) * 6.5}
                    stroke="#f59e0b"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                );
              })}
              <defs>
                <radialGradient id="sun-grad">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </radialGradient>
              </defs>
            </g>
          </>
        )}

        {isNight && (
          <text
            x="0"
            y="3"
            textAnchor="middle"
            style={{ fontSize: 14 }}
          >
            🌙
          </text>
        )}
      </svg>
    </div>
  );
}
