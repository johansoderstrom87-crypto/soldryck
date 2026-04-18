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
  const hasWind = windSpeed !== undefined;
  const hasTemp = temperature !== undefined;

  if (!hasSun && !hasWind && !hasTemp) return null;

  const lightDeg = hasSun ? (sunAzimuth + 180) % 360 : 0;

  return (
    <div className="flex justify-center">
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          borderRadius: 14,
          background: "linear-gradient(90deg, rgba(251,191,36,0.12) 0%, rgba(255,255,255,0.2) 35%, rgba(255,255,255,0.2) 65%, rgba(96,165,250,0.1) 100%)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04), inset 0 0 0 0.5px rgba(255,255,255,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Sun section */}
        {hasSun && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 10px" }}>
            <svg width="28" height="28" viewBox="-14 -14 28 28" style={{ display: "block", flexShrink: 0 }}>
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 5}
                    y1={Math.sin(a) * 5}
                    x2={Math.cos(a) * 8.5}
                    y2={Math.sin(a) * 8.5}
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx="0" cy="0" r="3.8" fill="#f59e0b" />
              <circle cx="0" cy="0" r="2" fill="#fbbf24" />
            </svg>
            <svg width="12" height="22" viewBox="0 0 12 22" style={{ display: "block", flexShrink: 0, transform: `rotate(${lightDeg}deg)` }}>
              <line x1="6" y1="19" x2="6" y2="5" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
              <polygon points="6,1 2.5,7.5 9.5,7.5" fill="#b45309" />
            </svg>
          </div>
        )}

        {/* Divider */}
        {hasSun && hasTemp && (
          <div style={{ width: 0.5, alignSelf: "center", height: 22, background: "rgba(0,0,0,0.1)", flexShrink: 0 }} />
        )}

        {/* Temperature section */}
        {hasTemp && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 10px" }}>
            <svg width="10" height="20" viewBox="0 0 10 20" style={{ display: "block", flexShrink: 0 }}>
              <rect x="3" y="1" width="4" height="12" rx="2" fill="none" stroke="#dc2626" strokeWidth="1" />
              <circle cx="5" cy="16" r="3" fill="none" stroke="#dc2626" strokeWidth="1" />
              <circle cx="5" cy="16" r="2" fill="#dc2626" />
              <rect x="4" y="7" width="2" height="7.5" rx="1" fill="#dc2626" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {Math.round(temperature)}°
            </div>
          </div>
        )}

        {/* Divider */}
        {hasTemp && hasWind && (
          <div style={{ width: 0.5, alignSelf: "center", height: 22, background: "rgba(0,0,0,0.1)", flexShrink: 0 }} />
        )}

        {/* Wind section */}
        {hasWind && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 10px" }}>
            <svg width="20" height="14" viewBox="0 0 20 14" style={{ display: "block", flexShrink: 0 }}>
              <path d="M2 4h9c2 0 3-1.2 3-2.5S13 0 11.5 0" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M2 7.5h12c1.5 0 2.8 1.2 2.8 2.5s-1.3 2.5-2.8 2.5" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M2 11h6c1.2 0 2 1 2 2s-.8 1-2 1" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {windSpeed > 0 && windDir !== undefined && (
              <svg width="10" height="18" viewBox="0 0 10 18" style={{ display: "block", flexShrink: 0, transform: `rotate(${(windDir + 180) % 360}deg)` }}>
                <line x1="5" y1="16" x2="5" y2="4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                <polygon points="5,1 2,6.5 8,6.5" fill="#2563eb" />
              </svg>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a", lineHeight: 1, whiteSpace: "nowrap" }}>
              {Math.round(windSpeed)}<span style={{ fontSize: 9, fontWeight: 500 }}> m/s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
