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

  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 0.4093 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const solarNoon = 12 - lng / 15 + 2; // CEST
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

/**
 * Sun gauge — shows where sunlight is coming FROM.
 * A small sun sits at the azimuth position on a ring,
 * with rays pointing inward toward the center (= toward you).
 */
function SunGauge({ azimuth }: { azimuth: number }) {
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const ring = 24;
  const rad = (azimuth * Math.PI) / 180;

  // Sun position on the ring
  const sx = cx + Math.sin(rad) * ring;
  const sy = cy - Math.cos(rad) * ring;

  // Rays pointing inward from sun toward center
  const rayCount = 8;
  const rayInner = 7;
  const rayOuter = 12;
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const a = (i * 2 * Math.PI) / rayCount;
    return {
      x1: sx + Math.cos(a) * rayInner,
      y1: sy + Math.sin(a) * rayInner,
      x2: sx + Math.cos(a) * rayOuter,
      y2: sy + Math.sin(a) * rayOuter,
    };
  });

  // Dashed lines from sun toward center (light beams)
  const beamLen = 10;
  const beamStart = 5; // gap from sun center
  const beamAngles = [-0.15, 0, 0.15]; // slight spread
  const beams = beamAngles.map((offset) => {
    const a = rad + Math.PI + offset; // toward center
    return {
      x1: sx + Math.sin(a) * beamStart,
      y1: sy - Math.cos(a) * beamStart,
      x2: sx + Math.sin(a) * (beamStart + beamLen),
      y2: sy - Math.cos(a) * (beamStart + beamLen),
    };
  });

  const cardinals = [
    { label: "N", angle: 0 },
    { label: "O", angle: 90 },
    { label: "S", angle: 180 },
    { label: "V", angle: 270 },
  ];

  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Compass ring */}
        <circle cx={cx} cy={cy} r={ring} fill="none" stroke="#e2e8f0" strokeWidth="1" />

        {/* Cardinal ticks + labels */}
        {cardinals.map(({ label, angle }) => {
          const a = (angle * Math.PI) / 180;
          const tickIn = ring - 3;
          const tickOut = ring + 1;
          const lblR = ring + 7;
          return (
            <g key={label}>
              <line
                x1={cx + Math.sin(a) * tickIn}
                y1={cy - Math.cos(a) * tickIn}
                x2={cx + Math.sin(a) * tickOut}
                y2={cy - Math.cos(a) * tickOut}
                stroke="#94a3b8"
                strokeWidth="1"
              />
              <text
                x={cx + Math.sin(a) * lblR}
                y={cy - Math.cos(a) * lblR + 3}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="#94a3b8"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Light beams from sun toward center */}
        {beams.map((b, i) => (
          <line
            key={i}
            x1={b.x1}
            y1={b.y1}
            x2={b.x2}
            y2={b.y2}
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 2"
            opacity="0.7"
          />
        ))}

        {/* Sun body */}
        <circle cx={sx} cy={sy} r="5" fill="#f59e0b" />

        {/* Sun rays */}
        {rays.map((r, i) => (
          <line
            key={i}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        {/* Center dot (you are here) */}
        <circle cx={cx} cy={cy} r="2" fill="#475569" />
      </svg>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>
          Solen
        </div>
        <div style={{ fontSize: 10, color: "#78350f" }}>
          fr&aring;n {degreesToCardinal(azimuth)}
        </div>
      </div>
    </div>
  );
}

/**
 * Wind gauge — shows where wind is blowing FROM with animated-looking streaks.
 * Arrow points in the direction the wind is heading (FROM → toward you).
 */
function WindGauge({ direction, speed }: { direction: number; speed: number }) {
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const ring = 24;

  // Wind comes FROM this direction, so arrows point FROM direction → center
  const fromRad = (direction * Math.PI) / 180;
  // Arrow pointing toward center (where the wind is going)
  const towardRad = fromRad + Math.PI;

  // Main arrow from edge toward center
  const arrowStart = ring - 2;
  const arrowEnd = 6;
  const ax1 = cx + Math.sin(fromRad) * arrowStart;
  const ay1 = cy - Math.cos(fromRad) * arrowStart;
  const ax2 = cx + Math.sin(fromRad) * arrowEnd;
  const ay2 = cy - Math.cos(fromRad) * arrowEnd;

  // Arrowhead at the tip (near center)
  const wingAngle = 0.45;
  const wingLen = 6;
  const w1x = ax2 - Math.sin(towardRad + wingAngle) * wingLen;
  const w1y = ay2 + Math.cos(towardRad + wingAngle) * wingLen;
  const w2x = ax2 - Math.sin(towardRad - wingAngle) * wingLen;
  const w2y = ay2 + Math.cos(towardRad - wingAngle) * wingLen;

  // Side streaks (parallel to main arrow, offset sideways)
  const streaks = [-8, 8].map((offset) => {
    const perpRad = fromRad + Math.PI / 2;
    const ox = Math.sin(perpRad) * offset;
    const oy = -Math.cos(perpRad) * offset;
    return {
      x1: cx + Math.sin(fromRad) * (ring - 6) + ox,
      y1: cy - Math.cos(fromRad) * (ring - 6) + oy,
      x2: cx + Math.sin(fromRad) * 12 + ox,
      y2: cy - Math.cos(fromRad) * 12 + oy,
    };
  });

  const cardinals = [
    { label: "N", angle: 0 },
    { label: "O", angle: 90 },
    { label: "S", angle: 180 },
    { label: "V", angle: 270 },
  ];

  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Compass ring */}
        <circle cx={cx} cy={cy} r={ring} fill="none" stroke="#e2e8f0" strokeWidth="1" />

        {/* Cardinal ticks + labels */}
        {cardinals.map(({ label, angle }) => {
          const a = (angle * Math.PI) / 180;
          const tickIn = ring - 3;
          const tickOut = ring + 1;
          const lblR = ring + 7;
          return (
            <g key={label}>
              <line
                x1={cx + Math.sin(a) * tickIn}
                y1={cy - Math.cos(a) * tickIn}
                x2={cx + Math.sin(a) * tickOut}
                y2={cy - Math.cos(a) * tickOut}
                stroke="#94a3b8"
                strokeWidth="1"
              />
              <text
                x={cx + Math.sin(a) * lblR}
                y={cy - Math.cos(a) * lblR + 3}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="#94a3b8"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Side streaks */}
        {streaks.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="#93c5fd"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        ))}

        {/* Main arrow shaft */}
        <line
          x1={ax1}
          y1={ay1}
          x2={ax2}
          y2={ay2}
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Arrowhead */}
        <polygon
          points={`${ax2},${ay2} ${w1x},${w1y} ${w2x},${w2y}`}
          fill="#3b82f6"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2" fill="#475569" />
      </svg>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af" }}>
          Vind
        </div>
        <div style={{ fontSize: 10, color: "#1e3a8a" }}>
          {Math.round(speed)} m/s fr&aring;n {degreesToCardinal(direction)}
        </div>
      </div>
    </div>
  );
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

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(14px) saturate(1.3)",
        WebkitBackdropFilter: "blur(14px) saturate(1.3)",
        border: "0.5px solid rgba(255,255,255,0.5)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      {hasSun && <SunGauge azimuth={sunAzimuth} />}
      {hasSun && hasWind && (
        <div style={{ width: 1, height: 40, background: "#e2e8f0" }} />
      )}
      {hasWind && <WindGauge direction={windDir} speed={windSpeed} />}
    </div>
  );
}
