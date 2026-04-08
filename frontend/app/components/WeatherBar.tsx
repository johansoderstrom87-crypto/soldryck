"use client";

import { type WeatherData, getSymbolInfo } from "../lib/weather";

interface WeatherBarProps {
  weather: WeatherData | null;
  hour: number;
  loading: boolean;
}

export default function WeatherBar({ weather, hour, loading }: WeatherBarProps) {
  if (loading) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg px-4 py-2.5 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </div>
    );
  }

  if (!weather) return null;

  const current = weather.hourly[hour];
  if (!current) return null;

  const symbol = getSymbolInfo(current.symbolCode);

  // Build mini forecast for the day
  const forecastHours = Array.from({ length: 16 }, (_, i) => i + 7);

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg px-4 py-2.5">
      {/* Current weather */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{symbol.icon}</span>
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {symbol.label}, {Math.round(current.temperature)}°C
          </div>
          <div className="text-[10px] text-slate-400">
            Vind {current.windSpeed} m/s
            {current.precipMm > 0 ? ` · ${current.precipMm} mm` : ""}
          </div>
        </div>
      </div>

      {/* Mini weather timeline */}
      <div className="flex gap-[3px]">
        {forecastHours.map((h) => {
          const hw = weather.hourly[h];
          if (!hw) return <div key={h} className="w-3 h-3 rounded-sm bg-slate-100" />;

          const s = getSymbolInfo(hw.symbolCode);
          const bg =
            s.category === "clear"
              ? "#fbbf24"
              : s.category === "clouds"
              ? "#cbd5e1"
              : s.category === "rain"
              ? "#60a5fa"
              : s.category === "thunder"
              ? "#a78bfa"
              : "#c4b5fd";
          const isActive = h === hour;

          return (
            <div
              key={h}
              className="flex-shrink-0 rounded-sm transition-all"
              style={{
                width: 14,
                height: 14,
                background: bg,
                border: isActive ? "2px solid #0f172a" : "none",
                opacity: isActive ? 1 : 0.7,
              }}
              title={`${h}:00 — ${s.label} ${Math.round(hw.temperature)}°C`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 px-0.5">
        <span>07</span>
        <span>14</span>
        <span>22</span>
      </div>
    </div>
  );
}
