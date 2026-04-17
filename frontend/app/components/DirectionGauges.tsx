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

  // Light direction = opposite of where the sun is
  const lightDeg = hasSun ? (sunAzimuth + 180) % 360 : 0;

  return (
    <div className="flex items-center justify-center gap-2.5">
      {/* Sun direction pill */}
      {hasSun && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px 8px 10px",
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.18) 100%)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            border: "1px solid rgba(251,191,36,0.35)",
            boxShadow: "0 4px 20px rgba(245,158,11,0.2), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Compass circle with arrow */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              boxShadow: "0 2px 10px rgba(245,158,11,0.45), inset 0 1px 1px rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 30 30">
              <defs>
                <linearGradient id="sunArrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="1" />
                  <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {/* Arrow pointing in light direction */}
              <g transform={`rotate(${lightDeg}, 15, 15)`}>
                {/* Shaft */}
                <line
                  x1="15" y1="24" x2="15" y2="6"
                  stroke="url(#sunArrowGrad)" strokeWidth="3" strokeLinecap="round"
                />
                {/* Arrowhead */}
                <polygon points="15,3 10,10 20,10" fill="white" />
              </g>
            </svg>
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Solriktning
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#78350f", letterSpacing: "-0.02em" }}>
              {degreesToCardinal(sunAzimuth)}
            </div>
          </div>
        </div>
      )}

      {/* Wind direction pill */}
      {hasWind && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px 8px 10px",
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(147,197,253,0.25) 0%, rgba(96,165,250,0.18) 100%)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            border: "1px solid rgba(147,197,253,0.4)",
            boxShadow: "0 4px 20px rgba(59,130,246,0.15), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Compass circle with arrow */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
              boxShadow: "0 2px 10px rgba(59,130,246,0.4), inset 0 1px 1px rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 30 30">
              <defs>
                <linearGradient id="windArrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="1" />
                  <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {/* Arrow pointing where wind comes FROM (toward viewer) */}
              <g transform={`rotate(${windDir! + 180}, 15, 15)`}>
                <line
                  x1="15" y1="24" x2="15" y2="6"
                  stroke="url(#windArrowGrad)" strokeWidth="3" strokeLinecap="round"
                />
                <polygon points="15,3 10,10 20,10" fill="white" />
              </g>
            </svg>
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#1e40af", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Vind
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.02em" }}>
              {Math.round(windSpeed)} m/s {degreesToCardinal(windDir)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
