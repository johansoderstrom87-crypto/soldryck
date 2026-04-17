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

  const textShadow = "0 1px 4px rgba(255,255,255,0.75), 0 0 12px rgba(255,255,255,0.4)";

  // Sun: arrow direction = where sunlight goes (opposite of azimuth)
  // Azimuth is where the sun IS, so light shines FROM there.
  // Arrow points in the direction the light travels = azimuth + 180.
  const sunArrowDeg = hasSun ? (sunAzimuth + 180) % 360 : 0;
  const sunArrowRad = (sunArrowDeg * Math.PI) / 180;

  // Wind: arrow shows where wind comes FROM
  const windArrowRad = windDir !== undefined ? (windDir * Math.PI) / 180 : 0;

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Sun direction */}
      {hasSun && (
        <div className="flex items-center gap-1.5">
          {/* Sun icon + arrow */}
          <svg width="36" height="36" viewBox="0 0 36 36">
            {/* Sun rays */}
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1={12 + Math.cos(a) * 5.5}
                  y1={12 + Math.sin(a) * 5.5}
                  x2={12 + Math.cos(a) * 8}
                  y2={12 + Math.sin(a) * 8}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              );
            })}
            {/* Sun body */}
            <circle cx="12" cy="12" r="4.5" fill="#f59e0b" />
            <circle cx="12" cy="12" r="3" fill="#fbbf24" />

            {/* Arrow from sun showing light direction */}
            <line
              x1={12 + Math.cos(sunArrowRad - Math.PI / 2) * 9}
              y1={12 + Math.sin(sunArrowRad - Math.PI / 2) * 9}
              x2={12 + Math.cos(sunArrowRad - Math.PI / 2) * 22}
              y2={12 + Math.sin(sunArrowRad - Math.PI / 2) * 22}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Arrowhead */}
            <polygon
              points={`
                ${12 + Math.cos(sunArrowRad - Math.PI / 2) * 22},${12 + Math.sin(sunArrowRad - Math.PI / 2) * 22}
                ${12 + Math.cos(sunArrowRad - Math.PI / 2 + 0.45) * 17},${12 + Math.sin(sunArrowRad - Math.PI / 2 + 0.45) * 17}
                ${12 + Math.cos(sunArrowRad - Math.PI / 2 - 0.45) * 17},${12 + Math.sin(sunArrowRad - Math.PI / 2 - 0.45) * 17}
              `}
              fill="#f59e0b"
            />
          </svg>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#000",
              textShadow,
              whiteSpace: "nowrap",
            }}
          >
            Solriktning ({degreesToCardinal(sunAzimuth)})
          </span>
        </div>
      )}

      {/* Wind direction */}
      {hasWind && (
        <div className="flex items-center gap-1">
          <svg width="20" height="20" viewBox="0 0 20 20">
            {/* Arrow pointing where wind goes (from windDir toward opposite) */}
            {(() => {
              const toRad = windArrowRad + Math.PI;
              const tailX = 10 + Math.sin(windArrowRad) * 8;
              const tailY = 10 - Math.cos(windArrowRad) * 8;
              const tipX = 10 + Math.sin(toRad) * 8;
              const tipY = 10 - Math.cos(toRad) * 8;
              return (
                <>
                  <line
                    x1={tailX} y1={tailY} x2={tipX} y2={tipY}
                    stroke="rgba(0,0,0,0.72)" strokeWidth="2" strokeLinecap="round"
                  />
                  <polygon
                    points={`
                      ${tipX},${tipY}
                      ${tipX - Math.sin(toRad + 0.5) * 4},${tipY + Math.cos(toRad + 0.5) * 4}
                      ${tipX - Math.sin(toRad - 0.5) * 4},${tipY + Math.cos(toRad - 0.5) * 4}
                    `}
                    fill="rgba(0,0,0,0.72)"
                  />
                </>
              );
            })()}
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(0,0,0,0.72)",
              textShadow,
            }}
          >
            {Math.round(windSpeed)} m/s
          </span>
        </div>
      )}
    </div>
  );
}
