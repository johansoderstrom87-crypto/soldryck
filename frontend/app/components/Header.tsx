"use client";

import { type WeatherData, getSymbolInfo, hasSunshine } from "../lib/weather";
import WeatherBar from "./WeatherBar";

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
  // Check if current weather blocks sun
  const currentWeather = weather?.hourly[hour];
  const actualSun = currentWeather ? hasSunshine(currentWeather.symbolCode) : true;
  const symbolInfo = currentWeather ? getSymbolInfo(currentWeather.symbolCode) : null;

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="flex items-start justify-between p-4 gap-3">
        {/* Left: Logo + stats + weather */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg px-5 py-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Soldryck
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {sunCount} av {totalCount} har sol just nu
            </p>
          </div>

          {/* Weather panel */}
          <WeatherBar
            weather={weather}
            hour={hour}
            loading={weatherLoading}
          />

          {/* Weather warning banner */}
          {currentWeather && !actualSun && symbolInfo && (
            <div
              className={`rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${
                symbolInfo.category === "rain" || symbolInfo.category === "thunder"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : symbolInfo.category === "snow"
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : "bg-slate-50 text-slate-600 border border-slate-200"
              }`}
            >
              <span>{symbolInfo.icon}</span>
              <span>
                {symbolInfo.category === "rain" || symbolInfo.category === "thunder"
                  ? "Regn just nu — kartan visar var solen når vid klart väder"
                  : symbolInfo.category === "snow"
                  ? "Snö just nu — kartan visar var solen når vid klart väder"
                  : "Molnigt — solplatserna stämmer vid uppklaring"}
              </span>
            </div>
          )}
        </div>

        {/* Right: Filter buttons */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-1.5 flex gap-1">
          {(["all", "sun", "shade"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
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
