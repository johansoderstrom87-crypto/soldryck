"use client";

import { type WeatherData } from "../lib/weather";

function getSunAzimuth(date: Date, hour: number): number | null {
  const lat = 59.33;
  const lng = 18.07;
  const latRad = (lat * Math.PI) / 180;

  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 0.4093 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const solarNoon = 12 - lng / 15 + 2;
  const hourAngle = ((hour - solarNoon) * 15 * Math.PI) / 180;

  const sinElev =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
  const elevation = Math.asin(sinElev);
  if (elevation <= 0) return null;

  const cosAz =
    (Math.sin(decl) - Math.sin(latRad) * sinElev) /
    (Math.cos(latRad) * Math.cos(elevation));
  let azimuth = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
  if (hourAngle > 0) azimuth = 360 - azimuth;

  return azimuth;
}

function degreesToCardinal(deg: number): string {
  const dirs = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];
  return dirs[Math.round(deg / 45) % 8];
}

interface DirectionGaugesProps {
  hour: number;
  date: Date;
  weather: WeatherData | null;
}

export default function DirectionGauges({ hour, date, weather }: DirectionGaugesProps) {
  const sunAzimuth = getSunAzimuth(date, hour);
  const windDir = weather?.hourly[hour]?.windDirection;
  const windSpeed = weather?.hourly[hour]?.windSpeed;

  const hasSun = sunAzimuth !== null;
  const hasWind = windDir !== undefined && windSpeed !== undefined && windSpeed > 0;

  if (!hasSun && !hasWind) return null;

  const lightDeg = hasSun ? (sunAzimuth + 180) % 360 : 0;

  return (
    <div className="flex items-end justify-between w-full max-w-md mx-auto px-1">
      {/* Sun — left corner, icon only */}
      {hasSun ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.18) 100%)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            border: "1px solid rgba(251,191,36,0.35)",
            boxShadow: "0 4px 20px rgba(245,158,11,0.2), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <svg width="44" height="44" viewBox="-22 -22 44 44" style={{ display: "block", overflow: "visible" }}>
            {/* Sun rays */}
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 5.5}
                  y1={Math.sin(a) * 5.5}
                  x2={Math.cos(a) * 9}
                  y2={Math.sin(a) * 9}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx="0" cy="0" r="4" fill="#f59e0b" />

            {/* Direction arrow */}
            <g transform={`rotate(${lightDeg})`}>
              <line x1="0" y1="-6" x2="0" y2="-17" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
              <polygon points="0,-20 -3.5,-14 3.5,-14" fill="#f59e0b" />
            </g>
          </svg>
        </div>
      ) : <div />}

      {/* Wind — right corner */}
      {hasWind ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(147,197,253,0.25) 0%, rgba(96,165,250,0.18) 100%)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            border: "1px solid rgba(147,197,253,0.4)",
            boxShadow: "0 4px 20px rgba(59,130,246,0.15), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <svg width="24" height="18" viewBox="0 0 24 18" style={{ flexShrink: 0 }}>
            <g transform={`rotate(${(windDir! + 180) % 360 - 180}, 12, 9)`}>
              <line x1="3" y1="5" x2="20" y2="5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <line x1="5" y1="9" x2="18" y2="9" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="13" x2="16" y2="13" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <polyline points="17,2 20,5 17,8" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#78716c" }}>
              Vind:
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em" }}>
              {degreesToCardinal(windDir)} ({Math.round(windSpeed)} m/s)
            </div>
          </div>
        </div>
      ) : <div />}
    </div>
  );
}
