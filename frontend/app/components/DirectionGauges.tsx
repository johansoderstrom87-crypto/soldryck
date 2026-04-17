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

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px) saturate(1.4)",
  WebkitBackdropFilter: "blur(16px) saturate(1.4)",
  border: "0.5px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
};

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
      {/* Sun — left corner */}
      {hasSun ? (
        <div style={cardStyle}>
          {/* Sun icon with direction arrow */}
          <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
            {/* Sun rays */}
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1={10 + Math.cos(a) * 5}
                  y1={10 + Math.sin(a) * 5}
                  x2={10 + Math.cos(a) * 8}
                  y2={10 + Math.sin(a) * 8}
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx="10" cy="10" r="3.5" fill="#f59e0b" />

            {/* Direction arrow from sun */}
            <g transform={`rotate(${lightDeg}, 10, 10)`}>
              <line x1="10" y1="5" x2="10" y2="-6" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
              <polygon points="10,-8 7,-3 13,-3" fill="#f59e0b" />
            </g>
          </svg>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#78716c" }}>
              Sol:
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em" }}>
              {degreesToCardinal(sunAzimuth)}
            </div>
          </div>
        </div>
      ) : <div />}

      {/* Wind — right corner */}
      {hasWind ? (
        <div style={cardStyle}>
          {/* Wind icon */}
          <svg width="26" height="20" viewBox="0 0 26 20" style={{ flexShrink: 0 }}>
            {/* Three wind lines */}
            <g transform={`rotate(${(windDir! + 180) % 360 - 180}, 13, 10)`}>
              <line x1="4" y1="6" x2="22" y2="6" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="10" x2="20" y2="10" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <line x1="4" y1="14" x2="18" y2="14" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              {/* Arrow tips */}
              <polyline points="19,3 22,6 19,9" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#78716c" }}>
              Vind:
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em" }}>
              {degreesToCardinal(windDir)} ({Math.round(windSpeed)} m/s)
            </div>
          </div>
        </div>
      ) : <div />}
    </div>
  );
}
