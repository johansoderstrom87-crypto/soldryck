"use client";

import { useMemo, useRef, useEffect } from "react";
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
  { label: "APR", month: 3 },
  { label: "MAJ", month: 4 },
  { label: "JUN", month: 5 },
  { label: "JUL", month: 6 },
  { label: "AUG", month: 7 },
  { label: "SEP", month: 8 },
  { label: "OKT", month: 9 },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22
const HOUR_WIDTH = 44; // px per hour column

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Smooth scroll to selected hour
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetScroll = (hour - 7) * HOUR_WIDTH - el.clientWidth / 2 + HOUR_WIDTH / 2;
    el.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" });
  }, [hour]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] p-3 pointer-events-none">
      <div
        className="pointer-events-auto max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "rgba(30, 30, 40, 0.55)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          border: "0.5px solid rgba(255, 255, 255, 0.1)",
          fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        }}
      >
        {/* Weather warning */}
        {currentWeather && !actualSun && symbolInfo && (
          <div
            className={`px-4 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1.5 ${
              symbolInfo.category === "rain" || symbolInfo.category === "thunder"
                ? "bg-blue-500/20 text-blue-200"
                : symbolInfo.category === "snow"
                ? "bg-purple-500/20 text-purple-200"
                : "bg-slate-500/20 text-slate-200"
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

        <div className="px-4 pt-3 pb-2.5">
          {/* Featured weather — current hour temp/wind/icon */}
          <div className="flex items-center justify-center gap-3 mb-2">
            {currentWeather && symbolInfo ? (
              <>
                <span className="text-3xl leading-none">{symbolInfo.icon}</span>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl leading-none text-white tabular-nums"
                    style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
                  >
                    {Math.round(currentWeather.temperature)}°C
                  </span>
                  <span className="text-[11px] text-white/60 font-medium uppercase tracking-wide">
                    {currentWeather.windSpeed} m/s
                  </span>
                </div>
              </>
            ) : weatherLoading ? (
              <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
            ) : (
              <span className="text-xs text-white/60">{sunCount}/{totalCount} ställen i sol</span>
            )}
          </div>

          {/* Hour timeline — scrollable with gradient + weather icons + big selected hour */}
          <div className="relative">
            <div
              ref={scrollRef}
              className="overflow-x-auto scrollbar-hide py-1"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                className="relative flex items-end"
                style={{ width: HOURS.length * HOUR_WIDTH, height: 96 }}
              >
                {/* Sun gradient strip behind hour numbers */}
                <div
                  className="absolute left-0 right-0 rounded-2xl"
                  style={{
                    bottom: 0,
                    height: 56,
                    background: "linear-gradient(90deg, rgba(15,23,42,0.9) 0%, rgba(255,180,80,0.35) 25%, rgba(255,220,140,0.6) 50%, rgba(255,180,80,0.35) 75%, rgba(15,23,42,0.9) 100%)",
                  }}
                />

                {HOURS.map((h) => {
                  const hw = weather?.hourly[h];
                  const isSelected = h === hour;
                  const hwSymbol = hw ? getSymbolInfo(hw.symbolCode) : null;
                  return (
                    <button
                      key={h}
                      onClick={() => onHourChange(h)}
                      className="relative flex flex-col items-center justify-end flex-shrink-0 group"
                      style={{ width: HOUR_WIDTH, height: "100%" }}
                      title={hw ? `${h}:00 — ${hwSymbol?.label} ${Math.round(hw.temperature)}°C` : `${h}:00`}
                    >
                      {/* Weather icon above */}
                      <span
                        className="relative z-10 transition-all duration-300 ease-out"
                        style={{
                          fontSize: isSelected ? 24 : 14,
                          opacity: isSelected ? 1 : 0.55,
                          marginBottom: isSelected ? 6 : 10,
                          filter: isSelected ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" : "none",
                          lineHeight: 1,
                        }}
                      >
                        {hwSymbol?.icon ?? "·"}
                      </span>

                      {/* Hour number */}
                      <div
                        className="relative z-10 flex items-center justify-center transition-all duration-300 ease-out tabular-nums"
                        style={{
                          width: isSelected ? 52 : HOUR_WIDTH - 4,
                          height: isSelected ? 52 : 36,
                          marginBottom: isSelected ? -8 : 0,
                          fontWeight: isSelected ? 900 : 500,
                          fontSize: isSelected ? 26 : 14,
                          color: isSelected ? "#fff" : "rgba(255,255,255,0.75)",
                          background: isSelected
                            ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                            : "transparent",
                          borderRadius: isSelected ? 16 : 8,
                          boxShadow: isSelected
                            ? "0 0 30px rgba(251, 146, 60, 0.6), 0 8px 24px rgba(251, 146, 60, 0.4), inset 0 1px 1px rgba(255,255,255,0.2)"
                            : "none",
                          letterSpacing: isSelected ? "-0.03em" : "0",
                        }}
                      >
                        {isSelected ? String(h).padStart(2, "0") : h}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-3 pb-1 -mx-1 px-1"
               style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {days.map((d, i) => {
              const dStr = d.toISOString().slice(0, 10);
              const isSelected = selectedDateStr === dStr;
              const dayName = i === 0 ? "IDAG" : (DAY_NAMES[d.getDay()] ?? "").toUpperCase();
              const dateLabel = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
              return (
                <button
                  key={dStr}
                  onClick={() => onDateChange(d)}
                  className="flex-shrink-0 rounded-full px-3 py-1.5 transition-all duration-200 flex flex-col items-center min-w-[56px]"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                      : "rgba(255, 255, 255, 0.08)",
                    boxShadow: isSelected
                      ? "0 4px 16px rgba(251, 146, 60, 0.4)"
                      : "none",
                    color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.75)",
                  }}
                >
                  <span className="text-[10px] font-bold tracking-wider leading-none">{dayName}</span>
                  <span
                    className="text-[9px] leading-tight mt-0.5"
                    style={{
                      color: isSelected ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.5)",
                      fontWeight: 500,
                    }}
                  >
                    {dateLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Month pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-1.5 -mx-1 px-1"
               style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
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
                  className="flex-shrink-0 rounded-full px-3.5 py-1 transition-all duration-200 text-[10px] font-bold tracking-wider"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                      : isCurrent && isInDayRange
                      ? "rgba(251, 146, 60, 0.2)"
                      : "rgba(255, 255, 255, 0.05)",
                    color: isSelected
                      ? "#fff"
                      : isCurrent && isInDayRange
                      ? "#fdba74"
                      : "rgba(255, 255, 255, 0.55)",
                    boxShadow: isSelected ? "0 4px 12px rgba(251, 146, 60, 0.4)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
