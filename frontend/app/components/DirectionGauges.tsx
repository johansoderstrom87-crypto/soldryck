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
  const windArrowDeg = windDir !== undefined ? (windDir + 180) % 360 : 0;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px) saturate(1.3)",
        WebkitBackdropFilter: "blur(12px) saturate(1.3)",
        border: "0.5px solid rgba(255,255,255,0.75)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
        whiteSpace: "nowrap",
      }}
    >
      {/* Sun direction arrow — sun circle sits at the tail, arrowhead points toward sun */}
      {hasSun && (
        <svg
          width="18"
          height="18"
          viewBox="-10 -10 20 20"
          style={{ display: "block", flexShrink: 0, transform: `rotate(${lightDeg}deg)`, overflow: "visible" }}
        >
          {/* Sun at tail (bottom before rotation) */}
          <circle cx="0" cy="7" r="3" fill="#fbbf24" />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={Math.cos(rad) * 3.6}
                y1={7 + Math.sin(rad) * 3.6}
                x2={Math.cos(rad) * 5.4}
                y2={7 + Math.sin(rad) * 5.4}
                stroke="#fbbf24"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            );
          })}
          {/* Shaft */}
          <line x1="0" y1="3.5" x2="0" y2="-5.5" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" />
          {/* Arrowhead */}
          <polygon points="0,-9 -2.5,-5 2.5,-5" fill="#92400e" />
        </svg>
      )}

      {/* Temperature — just the number, no icon */}
      {hasTemp && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#1c1917",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {Math.round(temperature)}°
        </span>
      )}

      {/* Wind — small direction arrow + speed text */}
      {hasWind && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {windSpeed > 0 && windDir !== undefined && (
            <svg
              width="10"
              height="10"
              viewBox="-5 -5 10 10"
              style={{ display: "block", flexShrink: 0, transform: `rotate(${windArrowDeg}deg)`, overflow: "visible" }}
            >
              <line x1="0" y1="4" x2="0" y2="-2" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
              <polygon points="0,-5 -2,-1 2,-1" fill="#2563eb" />
            </svg>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a", lineHeight: 1 }}>
            {Math.round(windSpeed)}
            <span style={{ fontSize: 9, fontWeight: 500 }}> m/s</span>
          </span>
        </div>
      )}
    </div>
  );
}
