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
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>

      {/* Sun direction arrow — bold filled, orange, rotates to sun direction */}
      {hasSun && (
        <svg
          width="22" height="22"
          viewBox="-11 -11 22 22"
          style={{ display: "block", flexShrink: 0, transform: `rotate(${lightDeg}deg)`, overflow: "visible" }}
        >
          {/* Bold notched arrowhead pointing up */}
          <polygon points="0,-11 -6,5 0,1 6,5" fill="#f97316" />
        </svg>
      )}

      {/* Temperature */}
      {hasTemp && (
        <span style={{ fontSize: 18, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {Math.round(temperature)}°C
        </span>
      )}

      {/* Vertical divider between temp and wind */}
      {hasTemp && hasWind && (
        <div style={{ width: 1.5, height: 22, background: "rgba(0,0,0,0.22)", flexShrink: 0, borderRadius: 1 }} />
      )}

      {/* Wind direction arrow — bold filled, blue */}
      {hasWind && windSpeed > 0 && windDir !== undefined && (
        <svg
          width="22" height="22"
          viewBox="-11 -11 22 22"
          style={{ display: "block", flexShrink: 0, transform: `rotate(${windArrowDeg}deg)`, overflow: "visible" }}
        >
          <polygon points="0,-11 -6,5 0,1 6,5" fill="#2563eb" />
        </svg>
      )}

      {/* Wind speed */}
      {hasWind && (
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111", lineHeight: 1 }}>
          {Math.round(windSpeed)}
          <span style={{ fontSize: 13, fontWeight: 500 }}> m/s</span>
        </span>
      )}

    </div>
  );
}
