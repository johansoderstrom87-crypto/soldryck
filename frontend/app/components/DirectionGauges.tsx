"use client";

import { type WeatherData } from "../lib/weather";

/**
 * Calculate solar azimuth for Stockholm.
 * Returns degrees 0-360 where 0=N, 90=E, 180=S, 270=W.
 */
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

/**
 * Sun arc with three rays.
 *
 * The sun follows an invisible semicircular arc from east (~90°) through
 * south (180°) to west (~270°). Three rays with arrowheads show the
 * direction sunlight is shining (from the sun, inward/downward).
 */
function SunArc({ azimuth }: { azimuth: number }) {
  const w = 140;
  const h = 70;

  // The arc is a semicircle: east (left) → south (bottom center) → west (right).
  // Map azimuth 60°–300° onto the arc. Center of arc at (w/2, 8).
  const arcCx = w / 2;
  const arcCy = 8;
  const arcR = 52;

  // Azimuth → angle on the arc. 90° (east) = left, 180° (south) = bottom, 270° (west) = right.
  // Map to drawing angle: 180° (left in SVG) for az=90, 270° (bottom) for az=180, 360° (right) for az=270.
  const arcAngle = ((azimuth - 90) / 180) * Math.PI + Math.PI; // radians on the semicircle

  const sunX = arcCx + Math.cos(arcAngle) * arcR;
  const sunY = arcCy + Math.sin(arcAngle) * arcR;

  // Three rays from the sun pointing inward (toward center/ground).
  // The direction from sun toward arc center, with slight spread.
  const toCenterAngle = Math.atan2(arcCy - sunY, arcCx - sunX);
  const rayLength = 22;
  const arrowSize = 5;
  const spreadAngles = [-0.3, 0, 0.3];

  const rays = spreadAngles.map((offset) => {
    const angle = toCenterAngle + offset;
    const ex = sunX + Math.cos(angle) * rayLength;
    const ey = sunY + Math.sin(angle) * rayLength;

    // Arrowhead at the end
    const aw1x = ex - Math.cos(angle - 0.45) * arrowSize;
    const aw1y = ey - Math.sin(angle - 0.45) * arrowSize;
    const aw2x = ex - Math.cos(angle + 0.45) * arrowSize;
    const aw2y = ey - Math.sin(angle + 0.45) * arrowSize;

    return { sx: sunX, sy: sunY, ex, ey, aw1x, aw1y, aw2x, aw2y };
  });

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {/* Three sun rays with arrowheads */}
      {rays.map((r, i) => (
        <g key={i}>
          <line
            x1={r.sx}
            y1={r.sy}
            x2={r.ex}
            y2={r.ey}
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon
            points={`${r.ex},${r.ey} ${r.aw1x},${r.aw1y} ${r.aw2x},${r.aw2y}`}
            fill="#f59e0b"
          />
        </g>
      ))}

      {/* Sun circle at current position */}
      <circle cx={sunX} cy={sunY} r="6" fill="#f59e0b" />
      <circle cx={sunX} cy={sunY} r="4" fill="#fbbf24" />
    </svg>
  );
}

/**
 * Wind arrow — a simple arrow showing where the wind comes FROM,
 * rendered above the wind speed text.
 */
function WindArrow({ direction }: { direction: number }) {
  const size = 20;
  const cx = size / 2;
  const cy = size / 2;
  const rad = (direction * Math.PI) / 180;

  // Arrow pointing FROM the wind direction (toward center)
  const len = 8;
  const tipX = cx - Math.sin(rad) * len; // pointing opposite = where wind goes
  const tipY = cy + Math.cos(rad) * len;
  const tailX = cx + Math.sin(rad) * len;
  const tailY = cy - Math.cos(rad) * len;

  const arrowSize = 4;
  const w1x = tipX + Math.sin(rad + 0.5) * arrowSize;
  const w1y = tipY - Math.cos(rad + 0.5) * arrowSize;
  const w2x = tipX + Math.sin(rad - 0.5) * arrowSize;
  const w2y = tipY - Math.cos(rad - 0.5) * arrowSize;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <line
        x1={tailX}
        y1={tailY}
        x2={tipX}
        y2={tipY}
        stroke="rgba(0,0,0,0.72)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polygon
        points={`${tipX},${tipY} ${w1x},${w1y} ${w2x},${w2y}`}
        fill="rgba(0,0,0,0.72)"
      />
    </svg>
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
    <div className="flex flex-col items-center">
      {hasSun && <SunArc azimuth={sunAzimuth} />}
      {hasWind && (
        <div className="flex items-center gap-1 mt-0.5">
          <WindArrow direction={windDir} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(0,0,0,0.72)",
              textShadow: "0 1px 4px rgba(255,255,255,0.75), 0 0 12px rgba(255,255,255,0.4)",
            }}
          >
            {Math.round(windSpeed)} m/s
          </span>
        </div>
      )}
    </div>
  );
}
