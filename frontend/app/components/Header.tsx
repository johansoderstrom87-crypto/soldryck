"use client";

import { useState, useRef, useEffect } from "react";
import { type WeatherData, getSymbolInfo, hasSunshine } from "../lib/weather";
import { VENUE_TYPES, type VenueType, type SunRange } from "./SunMap";
import { METRO_STATIONS, METRO_LINES, type MetroStation } from "../data/metro-stations";

const TYPE_OPTIONS: { value: VenueType; label: string; icon: string }[] = [
  { value: "restaurant", label: "Restaurang", icon: "🍽️" },
  { value: "cafe", label: "Café", icon: "☕" },
  { value: "bar", label: "Bar", icon: "🍺" },
  { value: "pub", label: "Pub", icon: "🍺" },
];

interface HeaderProps {
  filter: "all" | "sun" | "shade";
  onFilterChange: (filter: "all" | "sun" | "shade") => void;
  typeFilter: Set<VenueType>;
  onTypeFilterChange: (types: Set<VenueType>) => void;
  sunRange: SunRange;
  onSunRangeChange: (range: SunRange) => void;
  sunCount: number;
  totalCount: number;
  weather: WeatherData | null;
  weatherLoading: boolean;
  hour: number;
  showShadows: boolean;
  onToggleShadows: () => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
}

const FILTER_OPTIONS: { value: "all" | "sun" | "shade"; label: string; icon: string; activeClass: string }[] = [
  { value: "all", label: "Alla", icon: "◉", activeClass: "bg-slate-900 text-white" },
  { value: "sun", label: "Sol", icon: "☀️", activeClass: "bg-amber-500 text-white" },
  { value: "shade", label: "Skugga", icon: "☁️", activeClass: "bg-slate-500 text-white" },
];

function FilterButton({
  filter, onFilterChange, typeFilter, onTypeFilterChange, sunRange, onSunRangeChange, metroStation, onMetroStationChange,
}: {
  filter: "all" | "sun" | "shade";
  onFilterChange: (f: "all" | "sun" | "shade") => void;
  typeFilter: Set<VenueType>;
  onTypeFilterChange: (types: Set<VenueType>) => void;
  sunRange: SunRange;
  onSunRangeChange: (range: SunRange) => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
}) {
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
  const activeFilterCount = typeFilter.size + (sunRange ? 1 : 0) + (metroStation ? 1 : 0);

  function toggleType(type: VenueType) {
    const next = new Set(typeFilter);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onTypeFilterChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-xl shadow-lg backdrop-blur-md px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all bg-white/95 text-slate-600 hover:bg-white"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="1" y1="4" x2="15" y2="4" /><line x1="1" y1="8" x2="11" y2="8" /><line x1="1" y1="12" x2="13" y2="12" />
          <circle cx="13" cy="4" r="1.5" fill="currentColor" /><circle cx="5" cy="8" r="1.5" fill="currentColor" /><circle cx="9" cy="12" r="1.5" fill="currentColor" />
        </svg>
        {current.label}
        {activeFilterCount > 0 && (
          <span className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
            {activeFilterCount}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white/95 backdrop-blur-md rounded-xl shadow-lg p-1 min-w-[140px] z-10">
          {/* Sun/shade filter */}
          <div className="flex flex-col gap-0.5">
            {FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => { onFilterChange(o.value); }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center gap-1.5 transition-all ${
                  filter === o.value ? o.activeClass : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span className="text-[10px]">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-1" />

          {/* Type filter checkboxes */}
          <div className="px-1.5 py-0.5">
            <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Typ av ställe</div>
            {TYPE_OPTIONS.map((t) => (
              <label
                key={t.value}
                className="flex items-center gap-2 px-1.5 py-1 rounded-lg text-xs cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={typeFilter.size === 0 || typeFilter.has(t.value)}
                  onChange={() => toggleType(t.value)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span>{t.icon}</span>
                <span className="text-slate-600">{t.label}</span>
              </label>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-1" />

          {/* Sun time range filter */}
          <div className="px-1.5 py-0.5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Sol mellan</div>
              {sunRange && (
                <button
                  onClick={() => onSunRangeChange(null)}
                  className="text-[9px] text-amber-500 hover:text-amber-600 font-medium"
                >
                  Rensa
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={sunRange?.from ?? ""}
                onChange={(e) => {
                  const from = Number(e.target.value);
                  if (!from && from !== 0) { onSunRangeChange(null); return; }
                  onSunRangeChange({ from, to: sunRange?.to ?? Math.min(from + 4, 22) });
                }}
                className="flex-1 px-1.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 cursor-pointer"
              >
                <option value="">Från</option>
                {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
              <span className="text-slate-400 text-xs">–</span>
              <select
                value={sunRange?.to ?? ""}
                onChange={(e) => {
                  const to = Number(e.target.value);
                  if (!to) { onSunRangeChange(null); return; }
                  onSunRangeChange({ from: sunRange?.from ?? 8, to });
                }}
                className="flex-1 px-1.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 cursor-pointer"
              >
                <option value="">Till</option>
                {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            {sunRange && (
              <div className="text-[9px] text-amber-600 mt-1">
                Visar ställen med sol {String(sunRange.from).padStart(2, "0")}–{String(sunRange.to).padStart(2, "0")}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-1" />

          {/* Metro station filter */}
          <div className="px-1.5 py-0.5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Nära T-bana</div>
              {metroStation && (
                <button
                  onClick={() => onMetroStationChange(null)}
                  className="text-[9px] text-amber-500 hover:text-amber-600 font-medium"
                >
                  Rensa
                </button>
              )}
            </div>
            <select
              value={metroStation?.name ?? ""}
              onChange={(e) => {
                if (!e.target.value) { onMetroStationChange(null); return; }
                const station = METRO_STATIONS.find((s) => s.name === e.target.value) ?? null;
                onMetroStationChange(station);
              }}
              className="w-full px-1.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 cursor-pointer"
            >
              <option value="">Alla stationer</option>
              {METRO_STATIONS
                .sort((a, b) => a.name.localeCompare(b.name, "sv"))
                .map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
            </select>
            {metroStation && (
              <div className="text-[9px] text-amber-600 mt-1 flex items-center gap-1">
                <span>Visar inom 500m från {metroStation.name}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  filter,
  onFilterChange,
  typeFilter,
  onTypeFilterChange,
  sunRange,
  onSunRangeChange,
  sunCount,
  totalCount,
  weather,
  weatherLoading,
  hour,
  showShadows,
  onToggleShadows,
  metroStation,
  onMetroStationChange,
}: HeaderProps) {
  const currentWeather = weather?.hourly[hour];
  const actualSun = currentWeather ? hasSunshine(currentWeather.symbolCode) : true;
  const symbolInfo = currentWeather ? getSymbolInfo(currentWeather.symbolCode) : null;

  const forecastHours = Array.from({ length: 16 }, (_, i) => i + 7);

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="p-3">
        {/* Weather + branding + filter */}
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
              <div>
                <div className="flex gap-[2px]">
                  {forecastHours.map((h) => {
                    const hw = weather.hourly[h];
                    const bg = hw
                      ? (() => {
                          const s = getSymbolInfo(hw.symbolCode);
                          return s.category === "clear" ? "#fbbf24"
                            : s.category === "clouds" ? "#cbd5e1"
                            : s.category === "rain" ? "#60a5fa"
                            : s.category === "thunder" ? "#a78bfa"
                            : "#c4b5fd";
                        })()
                      : "#e2e8f0";
                    const title = hw
                      ? `${h}:00 — ${getSymbolInfo(hw.symbolCode).label} ${Math.round(hw.temperature)}°C`
                      : `${h}:00`;
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
                        title={title}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-[2px] mt-0.5">
                  {forecastHours.map((h) => (
                    <div
                      key={h}
                      className="flex-shrink-0 text-center"
                      style={{ width: 12, fontSize: 7, lineHeight: 1, color: h === hour ? "#0f172a" : "#94a3b8", fontWeight: h === hour ? 700 : 400 }}
                    >
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filter + shadow toggle */}
          <div className="flex items-center gap-1.5">
            <FilterButton filter={filter} onFilterChange={onFilterChange} typeFilter={typeFilter} onTypeFilterChange={onTypeFilterChange} sunRange={sunRange} onSunRangeChange={onSunRangeChange} metroStation={metroStation} onMetroStationChange={onMetroStationChange} />
            <button
              onClick={onToggleShadows}
              className={`rounded-xl shadow-lg backdrop-blur-md px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all ${
                showShadows
                  ? "bg-slate-900 text-white"
                  : "bg-white/95 text-slate-600 hover:bg-white"
              }`}
              title={showShadows ? "Dölj skuggor" : "Visa skuggor"}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="4" />
                <path d="M8 4v0a4 4 0 0 1 0 8v0" fill="currentColor" stroke="none" />
              </svg>
              Skuggor
            </button>
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
      </div>
    </div>
  );
}
