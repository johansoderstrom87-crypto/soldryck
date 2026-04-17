"use client";

import { type WeatherData } from "../lib/weather";

/**
 * Calculate solar azimuth (compass bearing of the sun) for Stockholm.
 * Returns degrees 0-360 where 0=N, 90=E, 180=S, 270=W.
 */
function getSunAzimuth(date: Date, hour: number): number | null {
  const lat = 59.33;
  const lng = 18.07;
  const latRad = (lat * Math.PI) / 180;

  // Day of year
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);

  // Solar declination
  const decl = 0.4093 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);

  // Solar noon in CEST (UTC+2)
  const solarNoon = 12 - lng / 15 + 2;

  // Hour angle (15 degrees per hour from solar noon)
  const hourAngle = ((hour - solarNoon) * 15 * Math.PI) / 180;

  // Solar elevation
  const sinElev =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
  const elevation = Math.asin(sinElev);

  // Sun below horizon
  if (elevation <= 0) return null;

  // Solar azimuth
  const cosAz =
    (Math.sin(decl) - Math.sin(latRad) * sinElev) /
    (Math.cos(latRad) * Math.cos(elevation));
  let azimuth = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;

  // Afternoon: azimuth > 180
  if (hourAngle > 0) azimuth = 360 - azimuth;

  return azimuth;
}

function CompassDial({
  direction,
  label,
  icon,
  fromLabel,
  color,
}: {
  direction: number;
  label: string;
  icon: string;
  fromLabel: string;
  color: string;
}) {
  const size = 52;
  const center = size / 2;
  const radius = 20;

  // Cardinal direction labels
  const cardinals = ["N", "O", "S", "V"];
  const cardinalAngles = [0, 90, 180, 270];

  // Arrow points in the direction
  const arrowRad = (direction * Math.PI) / 180;
  const arrowLen = 14;
  const ax = center + Math.sin(arrowRad) * arrowLen;
  const ay = center - Math.cos(arrowRad) * arrowLen;
  // Tail
  const tx = center - Math.sin(arrowRad) * 6;
  const ty = center + Math.cos(arrowRad) * 6;
  // Arrowhead wings
  const wingAngle = 0.4;
  const wingLen = 5;
  const w1x = ax - Math.sin(arrowRad + wingAngle) * wingLen;
  const w1y = ay + Math.cos(arrowRad + wingAngle) * wingLen;
  const w2x = ax - Math.sin(arrowRad - wingAngle) * wingLen;
  const w2y = ay + Math.cos(arrowRad - wingAngle) * wingLen;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="rounded-xl"
        style={{
          width: size + 4,
          height: size + 4,
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Compass circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Tick marks */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const isMajor = i % 3 === 0;
            const inner = radius - (isMajor ? 4 : 2);
            const outer = radius;
            return (
              <line
                key={i}
                x1={center + Math.sin(angle) * inner}
                y1={center - Math.cos(angle) * inner}
                x2={center + Math.sin(angle) * outer}
                y2={center - Math.cos(angle) * outer}
                stroke={isMajor ? "#94a3b8" : "#cbd5e1"}
                strokeWidth={isMajor ? 1.2 : 0.7}
              />
            );
          })}

          {/* Cardinal labels */}
          {cardinals.map((c, i) => {
            const angle = (cardinalAngles[i] * Math.PI) / 180;
            const labelR = radius + 4.5;
            return (
              <text
                key={c}
                x={center + Math.sin(angle) * labelR}
                y={center - Math.cos(angle) * labelR + 3}
                textAnchor="middle"
                fontSize="7"
                fontWeight="600"
                fill="#94a3b8"
              >
                {c}
              </text>
            );
          })}

          {/* Direction arrow */}
          <line
            x1={tx}
            y1={ty}
            x2={ax}
            y2={ay}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon
            points={`${ax},${ay} ${w1x},${w1y} ${w2x},${w2y}`}
            fill={color}
          />

          {/* Center dot */}
          <circle cx={center} cy={center} r="2.5" fill={color} />
        </svg>
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "#64748b",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        <span style={{ fontSize: 11 }}>{icon}</span> {label}
      </div>
      <div style={{ fontSize: 8, color: "#94a3b8", textAlign: "center" }}>
        {fromLabel}
      </div>
    </div>
  );
}

function degreesToCardinal(deg: number): string {
  const dirs = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

interface DirectionGaugesProps {
  hour: number;
  date: Date;
  weather: WeatherData | null;
}

export default function DirectionGauges({
  hour,
  date,
  weather,
}: DirectionGaugesProps) {
  const sunAzimuth = getSunAzimuth(date, hour);
  const windDir = weather?.hourly[hour]?.windDirection;
  const windSpeed = weather?.hourly[hour]?.windSpeed;

  // Nothing to show if sun is down and no wind data
  if (sunAzimuth === null && (windDir === undefined || windDir === 0)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {sunAzimuth !== null && (
        <CompassDial
          direction={sunAzimuth}
          label="Sol"
          icon="☀️"
          fromLabel={`${Math.round(sunAzimuth)}° ${degreesToCardinal(sunAzimuth)}`}
          color="#f59e0b"
        />
      )}
      {windDir !== undefined && windSpeed !== undefined && windSpeed > 0 && (
        <CompassDial
          direction={windDir}
          label="Vind"
          icon="💨"
          fromLabel={`${Math.round(windSpeed)} m/s ${degreesToCardinal(windDir)}`}
          color="#3b82f6"
        />
      )}
    </div>
  );
}
