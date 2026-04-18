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
  const hasWind = windDir !== undefined && windSpeed !== undefined && windSpeed > 0;
  const hasTemp = temperature !== undefined;

  if (!hasSun && !hasWind && !hasTemp) return null;

  const lightDeg = hasSun ? (sunAzimuth + 180) % 360 : 0;

  // Fixed-width sections so the bar never resizes when values change
  const sunW = 80;
  const tempW = 90;
  const windW = 100;

  return (
    <div className="flex justify-center">
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          borderRadius: 18,
          background: "linear-gradient(90deg, rgba(251,191,36,0.28) 0%, rgba(251,191,36,0.08) 28%, rgba(255,255,255,0.72) 42%, rgba(255,255,255,0.72) 58%, rgba(96,165,250,0.08) 72%, rgba(96,165,250,0.24) 100%)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          border: "1px solid transparent",
          backgroundClip: "padding-box",
          boxShadow: "0 4px 24px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.45)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Gradient border overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            padding: 1,
            background: "linear-gradient(90deg, rgba(251,191,36,0.5), rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.3) 60%, rgba(96,165,250,0.45))",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            pointerEvents: "none",
          }}
        />

        {/* Sun section */}
        <div
          style={{
            width: hasSun ? sunW : 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: hasSun ? "10px 8px" : 0,
            transition: "width 0.3s ease",
          }}
        >
          {hasSun && (
            <>
              {/* Sun icon */}
              <svg width="36" height="36" viewBox="-18 -18 36 36" style={{ display: "block", flexShrink: 0 }}>
                {Array.from({ length: 8 }, (_, i) => {
                  const a = (i * Math.PI) / 4;
                  return (
                    <line
                      key={i}
                      x1={Math.cos(a) * 6}
                      y1={Math.sin(a) * 6}
                      x2={Math.cos(a) * 10}
                      y2={Math.sin(a) * 10}
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle cx="0" cy="0" r="4.5" fill="#f59e0b" />
                <circle cx="0" cy="0" r="2.5" fill="#fbbf24" />
              </svg>
              {/* Direction arrow */}
              <svg width="16" height="28" viewBox="0 0 16 28" style={{ display: "block", flexShrink: 0, transform: `rotate(${lightDeg}deg)`, transition: "transform 0.4s ease" }}>
                <line x1="8" y1="24" x2="8" y2="6" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" />
                <polygon points="8,1 3.5,9 12.5,9" fill="#b45309" />
              </svg>
            </>
          )}
        </div>

        {/* Divider sun|temp */}
        {hasSun && hasTemp && (
          <div style={{ width: 1, alignSelf: "center", height: 28, background: "linear-gradient(180deg, rgba(251,191,36,0.15), rgba(0,0,0,0.12), rgba(0,0,0,0.04))", flexShrink: 0 }} />
        )}

        {/* Temperature section */}
        <div
          style={{
            width: hasTemp ? tempW : 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: hasTemp ? "8px 10px" : 0,
            transition: "width 0.3s ease",
          }}
        >
          {hasTemp && (
            <>
              {/* Thermometer icon — clean pill style */}
              <svg width="14" height="26" viewBox="0 0 14 26" style={{ display: "block", flexShrink: 0 }}>
                {/* Stem */}
                <rect x="4.5" y="1" width="5" height="16" rx="2.5" fill="none" stroke="#dc2626" strokeWidth="1.2" />
                {/* Bulb */}
                <circle cx="7" cy="20.5" r="4" fill="none" stroke="#dc2626" strokeWidth="1.2" />
                {/* Mercury fill */}
                <circle cx="7" cy="20.5" r="2.8" fill="#dc2626" />
                <rect x="5.5" y="9" width="3" height="10" rx="1.5" fill="#dc2626" />
                {/* Scale ticks */}
                <line x1="9.5" y1="5" x2="11" y2="5" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="9.5" y1="8" x2="10.5" y2="8" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="9.5" y1="11" x2="11" y2="11" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="9.5" y1="14" x2="10.5" y2="14" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {Math.round(temperature)}°
              </div>
            </>
          )}
        </div>

        {/* Divider temp|wind */}
        {hasTemp && hasWind && (
          <div style={{ width: 1, alignSelf: "center", height: 28, background: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.12), rgba(96,165,250,0.15))", flexShrink: 0 }} />
        )}

        {/* Wind section */}
        <div
          style={{
            width: hasWind ? windW : 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: hasWind ? "10px 8px" : 0,
            transition: "width 0.3s ease",
          }}
        >
          {hasWind && (
            <>
              {/* Wind icon — flowing curves */}
              <svg width="26" height="20" viewBox="0 0 26 20" style={{ display: "block", flexShrink: 0 }}>
                <path d="M3 6h12c2.5 0 4-1.5 4-3.5S17.5 0 15.5 0" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 10.5h16c2 0 3.5 1.5 3.5 3s-1.5 3-3.5 3" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 15h8c1.5 0 2.5 1.2 2.5 2.5S12.5 20 11 20" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {/* Direction arrow */}
              <svg width="16" height="28" viewBox="0 0 16 28" style={{ display: "block", flexShrink: 0, transform: `rotate(${(windDir! + 180) % 360}deg)`, transition: "transform 0.4s ease" }}>
                <line x1="8" y1="24" x2="8" y2="6" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                <polygon points="8,1 3.5,9 12.5,9" fill="#2563eb" />
              </svg>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a8a", lineHeight: 1, whiteSpace: "nowrap" }}>
                {Math.round(windSpeed)}<span style={{ fontSize: 10, fontWeight: 500 }}> m/s</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
