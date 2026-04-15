"use client";

import { useMemo } from "react";
import { type WeatherData, getSymbolInfo, hasSunshine } from "../lib/weather";

interface TimeSliderProps {
  hour: number;
  onHourChange: (hour: number) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  weather: WeatherData | null;
  weatherLoading: boolean;
  sunCount: number;
  totalCount: number;
}

const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTH_NAMES_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTHS = [
  { label: "Apr", month: 3 },
  { label: "Maj", month: 4 },
  { label: "Jun", month: 5 },
  { label: "Jul", month: 6 },
  { label: "Aug", month: 7 },
  { label: "Sep", month: 8 },
  { label: "Okt", month: 9 },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22

function hourColor(symbolCode: number | undefined): string {
  if (symbolCode === undefined) return "#e2e8f0";
  const cat = getSymbolInfo(symbolCode).category;
  return cat === "clear" ? "#fbbf24"
    : cat === "clouds" ? "#cbd5e1"
    : cat === "rain" ? "#60a5fa"
    : cat === "thunder" ? "#a78bfa"
    : "#c4b5fd";
}

export default function TimeSlider({
  hour,
  onHourChange,
  date,
  onDateChange,
  weather,
  weatherLoading,
  sunCount,
  totalCount,
}: TimeSliderProps) {
  // Generate 8 days: today + 7 days forward
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const selectedDateStr = date.toISOString().slice(0, 10);
  const selectedMonth = date.getMonth();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const isInDayRange = days.some((d) => d.toISOString().slice(0, 10) === selectedDateStr);

  const currentWeather = weather?.hourly[hour];
  const symbolInfo = currentWeather ? getSymbolInfo(currentWeather.symbolCode) : null;
  const actualSun = currentWeather ? hasSunshine(currentWeather.symbolCode) : true;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 pt-2.5 pb-3">
        {/* Weather warning — shown above everything when relevant */}
        {currentWeather && !actualSun && symbolInfo && (
          <div
            className={`rounded-lg px-2.5 py-1 mb-2 text-[10px] font-medium flex items-center gap-1 ${
              symbolInfo.category === "rain" || symbolInfo.category === "thunder"
                ? "bg-blue-50 text-blue-600"
                : symbolInfo.category === "snow"
                ? "bg-purple-50 text-purple-600"
                : "bg-slate-50 text-slate-500"
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

        {/* Current weather summary — centered above timeline */}
        <div className="flex items-center justify-center gap-2 mb-1.5 min-h-[20px]">
          {currentWeather && symbolInfo ? (
            <>
              <span className="text-sm leading-none">{symbolInfo.icon}</span>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                {Math.round(currentWeather.temperature)}°C
              </span>
              <span className="text-[10px] text-slate-400">
                {symbolInfo.label} · {currentWeather.windSpeed} m/s
                {currentWeather.precipMm > 0 ? ` · ${currentWeather.precipMm} mm` : ""}
              </span>
            </>
          ) : weatherLoading ? (
            <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
          ) : (
            <span className="text-[10px] text-slate-400">{sunCount}/{totalCount} i sol</span>
          )}
        </div>

        {/* Hour timeline — clickable, with weather-colored squares and big selected hour */}
        <div className="flex items-end gap-1 mb-3">
          {/* Hour strip */}
          <div className="flex-1 grid grid-cols-16 gap-[2px]" style={{ gridTemplateColumns: `repeat(${HOURS.length}, 1fr)` }}>
            {HOURS.map((h) => {
              const hw = weather?.hourly[h];
              const isSelected = h === hour;
              return (
                <button
                  key={h}
                  onClick={() => onHourChange(h)}
                  className="flex flex-col items-center gap-0.5 py-0.5"
                  title={hw ? `${h}:00 — ${getSymbolInfo(hw.symbolCode).label} ${Math.round(hw.temperature)}°C` : `${h}:00`}
                >
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: isSelected ? 14 : 10,
                      background: hourColor(hw?.symbolCode),
                      opacity: isSelected ? 1 : 0.55,
                      boxShadow: isSelected ? "0 0 0 2px #0f172a" : "none",
                    }}
                  />
                  <span
                    className={`text-[9px] tabular-nums leading-none ${
                      isSelected ? "text-slate-900 font-bold" : "text-slate-400"
                    }`}
                  >
                    {h}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Large selected hour display */}
          <div className="flex-shrink-0 pl-2 pb-1 text-right">
            <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
              {String(hour).padStart(2, "0")}
            </span>
            <span className="text-sm text-slate-400">:00</span>
          </div>
        </div>

        {/* Day selector — upcoming 8 days */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((d, i) => {
            const dStr = d.toISOString().slice(0, 10);
            const isSelected = selectedDateStr === dStr;
            const dayName = i === 0 ? "Idag" : i === 1 ? "Imorgon" : DAY_NAMES[d.getDay()];
            const dateLabel = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
            return (
              <button
                key={dStr}
                onClick={() => onDateChange(d)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex flex-col items-center min-w-[52px] ${
                  isSelected
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span className="font-semibold">{dayName}</span>
                <span className={`text-[9px] ${isSelected ? "text-amber-100" : "text-slate-400"}`}>{dateLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-1 overflow-x-auto pt-1">
          {MONTHS.map(({ label, month }) => {
            const isSelected = !isInDayRange && selectedMonth === month;
            const isCurrent = now.getMonth() === month;
            return (
              <button
                key={month}
                onClick={() => {
                  const d = new Date(now.getFullYear(), month, 15);
                  onDateChange(d);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? "bg-amber-500 text-white shadow-sm"
                    : isCurrent && isInDayRange
                    ? "text-amber-600 bg-amber-50"
                    : "text-slate-400 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
