"use client";

import { type HourlyWeather } from "../lib/weather";

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
  currentWeather: HourlyWeather | null;
}

export default function DirectionGauges({ hour, date, currentWeather }: DirectionGaugesProps) {
  const sunAzimuth = getSunAzimuth(date, hour);
  const windDir = currentWeather?.windDirection;
  const windSpeed = currentWeather?.windSpeed;
  const temperature = currentWeather?.temperature;

  const hasSun = sunAzimuth !== null;
  const hasWind = windDir !== undefined && windSpeed !== undefined && windSpeed > 0;
  const hasTemp = temperature !== undefined;

  if (!hasSun && !hasWind && !hasTemp) return null;

  const lightDeg = hasSun ? (sunAzimuth + 180) % 360 : 0;

  return (
    <div className="flex justify-center">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderRadius: 16,
          background: "linear-gradient(90deg, rgba(251,191,36,0.22) 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.7) 60%, rgba(147,197,253,0.18) 100%)",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Sun section */}
        {hasSun && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px" }}>
            {/* Sun icon with arrow */}
            <svg width="32" height="32" viewBox="-16 -16 32 32" style={{ display: "block", flexShrink: 0 }}>
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 4.5}
                    y1={Math.sin(a) * 4.5}
                    x2={Math.cos(a) * 7.5}
                    y2={Math.sin(a) * 7.5}
                    stroke="#f59e0b"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx="0" cy="0" r="3.5" fill="#f59e0b" />
            </svg>
            {/* Direction arrow */}
            <svg width="14" height="22" viewBox="0 0 14 22" style={{ display: "block", flexShrink: 0, transform: `rotate(${lightDeg}deg)` }}>
              <line x1="7" y1="20" x2="7" y2="4" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" />
              <polygon points="7,0 2.5,7 11.5,7" fill="#b45309" />
            </svg>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#92400e" }}>Sol:</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#78350f" }}>{degreesToCardinal(sunAzimuth)}</div>
            </div>
          </div>
        )}

        {/* Divider */}
        {hasSun && hasTemp && (
          <div style={{ width: 1, height: 32, background: "rgba(0,0,0,0.1)", flexShrink: 0 }} />
        )}

        {/* Temperature section */}
        {hasTemp && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px" }}>
            {/* Thermometer icon */}
            <svg width="16" height="28" viewBox="0 0 16 28" style={{ display: "block", flexShrink: 0 }}>
              <rect x="5" y="2" width="6" height="18" rx="3" fill="none" stroke="#ef4444" strokeWidth="1.5" />
              <circle cx="8" cy="22" r="4" fill="none" stroke="#ef4444" strokeWidth="1.5" />
              <circle cx="8" cy="22" r="2.5" fill="#ef4444" />
              <rect x="6.5" y="8" width="3" height="12" rx="1.5" fill="#ef4444" />
            </svg>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {Math.round(temperature)}°C
            </div>
          </div>
        )}

        {/* Divider */}
        {hasTemp && hasWind && (
          <div style={{ width: 1, height: 32, background: "rgba(0,0,0,0.1)", flexShrink: 0 }} />
        )}

        {/* Wind section */}
        {hasWind && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px" }}>
            {/* Wind lines icon */}
            <svg width="22" height="16" viewBox="0 0 22 16" style={{ display: "block", flexShrink: 0 }}>
              <line x1="2" y1="4" x2="18" y2="4" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
              <line x1="4" y1="8" x2="16" y2="8" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
              <line x1="2" y1="12" x2="14" y2="12" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
              <polyline points="15,1 18,4 15,7" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Direction arrow */}
            <svg width="14" height="22" viewBox="0 0 14 22" style={{ display: "block", flexShrink: 0, transform: `rotate(${(windDir! + 180) % 360}deg)` }}>
              <line x1="7" y1="20" x2="7" y2="4" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" />
              <polygon points="7,0 2.5,7 11.5,7" fill="#1e40af" />
            </svg>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#1e40af" }}>Vind:</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1e3a8a" }}>{degreesToCardinal(windDir)} ({Math.round(windSpeed)} m/s)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
