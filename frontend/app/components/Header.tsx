"use client";

import { useState, useRef, useEffect } from "react";
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

const FILTER_OPTIONS: { value: "all" | "sun" | "shade"; label: string; icon: string; activeClass: string }[] = [
  { value: "all", label: "Alla", icon: "◉", activeClass: "bg-slate-900 text-white" },
  { value: "sun", label: "Sol", icon: "☀️", activeClass: "bg-amber-500 text-white" },
  { value: "shade", label: "Skugga", icon: "☁️", activeClass: "bg-slate-500 text-white" },
];

function FilterButton({ filter, onFilterChange }: { filter: "all" | "sun" | "shade"; onFilterChange: (f: "all" | "sun" | "shade") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = FILTER_OPTIONS.find((o) => o.value === filter)!;

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        onClick={() => setOpen(!open)}
        className={`rounded-xl shadow-lg backdrop-blur-md px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-all bg-white/95 ${current.activeClass}`}
      >
        <span className="text-[10px]">{current.icon}</span>
        {current.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white/95 backdrop-blur-md rounded-xl shadow-lg p-1 flex flex-col gap-0.5 min-w-[90px]">
          {FILTER_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => { onFilterChange(o.value); setOpen(false); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center gap-1.5 transition-all ${
                filter === o.value ? o.activeClass : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className="text-[10px]">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

        {/* Right: Filter dropdown */}
        <FilterButton filter={filter} onFilterChange={onFilterChange} />
      </div>
    </div>
  );
}
