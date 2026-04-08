"use client";

import { type WeatherData, getSymbolInfo, hasSunshine } from "../lib/weather";

interface HeaderProps {
  filter: "all" | "sun" | "shade";
  onFilterChange: (filter: "all" | "sun" | "shade") => void;
  sunCount: number;
  totalCount: number;
  weather: WeatherData | null;
  weatherLoading: boolean;
  hour: number;
}

export default function Header({
  filter,
  onFilterChange,
  sunCount,
  totalCount,
  weather,
  weatherLoading,
  hour,
}: HeaderProps) {
  const currentWeather = weather?.hourly[hour];
  const actualSun = currentWeather ? hasSunshine(currentWeather.symbolCode) : true;
  const symbolInfo = currentWeather ? getSymbolInfo(currentWeather.symbolCode) : null;

  const forecastHours = Array.from({ length: 16 }, (_, i) => i + 7);

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="flex items-start justify-between p-3 gap-2">
        {/* Left: Combined weather + branding card */}
        <div className="flex flex-col gap-1.5 pointer-events-auto max-w-[260px]">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg px-3.5 py-2.5">
            {/* Top row: weather left, branding right */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              {/* Weather info */}
              {currentWeather && symbolInfo ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base leading-none">{symbolInfo.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {symbolInfo.label}, {Math.round(currentWeather.temperature)}°C
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      Vind {currentWeather.windSpeed} m/s
                      {currentWeather.precipMm > 0 ? ` · ${currentWeather.precipMm} mm` : ""}
                    </div>
                  </div>
                </div>
              ) : weatherLoading ? (
                <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
              ) : (
                <div />
              )}

              {/* Branding + stats */}
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-slate-900 leading-tight">Soldryck</div>
                <div className="text-[9px] text-slate-400">{sunCount}/{totalCount} sol</div>
              </div>
            </div>

            {/* Weather timeline */}
            {weather && (
              <div className="flex gap-[2px]">
                {forecastHours.map((h) => {
                  const hw = weather.hourly[h];
                  if (!hw) return <div key={h} className="w-2.5 h-2.5 rounded-sm bg-slate-100 flex-shrink-0" />;
                  const s = getSymbolInfo(hw.symbolCode);
                  const bg =
                    s.category === "clear" ? "#fbbf24"
                    : s.category === "clouds" ? "#cbd5e1"
                    : s.category === "rain" ? "#60a5fa"
                    : s.category === "thunder" ? "#a78bfa"
                    : "#c4b5fd";
                  return (
                    <div
                      key={h}
                      className="flex-shrink-0 rounded-sm"
                      style={{
                        width: 12, height: 12,
                        background: bg,
                        border: h === hour ? "2px solid #0f172a" : "none",
                        opacity: h === hour ? 1 : 0.6,
                      }}
                      title={`${h}:00 — ${s.label} ${Math.round(hw.temperature)}°C`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Weather warning — compact */}
          {currentWeather && !actualSun && symbolInfo && (
            <div
              className={`rounded-xl px-2.5 py-1.5 text-[10px] font-medium flex items-center gap-1 ${
                symbolInfo.category === "rain" || symbolInfo.category === "thunder"
                  ? "bg-blue-50/90 text-blue-600 border border-blue-200"
                  : symbolInfo.category === "snow"
                  ? "bg-purple-50/90 text-purple-600 border border-purple-200"
                  : "bg-slate-50/90 text-slate-500 border border-slate-200"
              }`}
            >
              <span>{symbolInfo.icon}</span>
              <span>
                {symbolInfo.category === "rain" || symbolInfo.category === "thunder"
                  ? "Regn — kartan visar sol vid klart väder"
                  : symbolInfo.category === "snow"
                  ? "Snö — kartan visar sol vid klart väder"
                  : "Mulet — solplatserna stämmer vid uppklaring"}
              </span>
            </div>
          )}
        </div>

        {/* Right: Filter buttons */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-1 flex gap-0.5">
          {(["all", "sun", "shade"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                filter === f
                  ? f === "sun"
                    ? "bg-amber-500 text-white"
                    : f === "shade"
                    ? "bg-slate-500 text-white"
                    : "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f === "all" ? "Alla" : f === "sun" ? "Sol" : "Skugga"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
