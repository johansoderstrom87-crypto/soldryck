"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { type WeatherData, type HourlyWeather, getSymbolInfo, toLocalDateStr } from "../lib/weather";

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

const DAY_NAMES = ["SÖN", "MÅN", "TIS", "ONS", "TOR", "FRE", "LÖR"];
const MONTH_NAMES_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTHS = [
  { label: "APR", month: 3 },
  { label: "MAJ", month: 4 },
  { label: "JUNI", month: 5 },
  { label: "JULI", month: 6 },
  { label: "AUG", month: 7 },
  { label: "SEP", month: 8 },
  { label: "OKT", month: 9 },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22

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
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const realNow = new Date();
  const todayStr = toLocalDateStr(realNow);
  const currentRealHour = realNow.getHours();
  const selectedDateStr = toLocalDateStr(date);
  const displayIsPast = selectedDateStr < todayStr;
  const displayIsToday = selectedDateStr === todayStr;

  const isPastHour = useCallback(
    (h: number): boolean => {
      if (displayIsPast) return true;
      if (displayIsToday && h < currentRealHour) return true;
      return false;
    },
    [displayIsPast, displayIsToday, currentRealHour]
  );

  const getHourWeather = useCallback(
    (h: number): HourlyWeather | null => {
      if (!weather) return null;
      if (weather.hourly[h]) return weather.hourly[h];
      // Fallback to nearest hour with data (prefer forward)
      for (let d = 1; d <= 6; d++) {
        if (weather.hourly[h + d]) return weather.hourly[h + d];
        if (weather.hourly[h - d]) return weather.hourly[h - d];
      }
      return null;
    },
    [weather]
  );

  const selectedMonth = date.getMonth();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isInDayRange = days.some((d) => toLocalDateStr(d) === selectedDateStr);

  const currentWeather = getHourWeather(hour);

  const updateHourFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = Math.round(ratio * (HOURS.length - 1));
      const h = HOURS[idx];
      if (h !== undefined && h !== hour) onHourChange(h);
    },
    [hour, onHourChange]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    updateHourFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateHourFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setDragging(false);
  };

  const textShadowOnMap = "0 1px 4px rgba(255,255,255,0.75), 0 0 12px rgba(255,255,255,0.4)";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] p-3 pointer-events-none"
      style={{ fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif" }}
    >
      {/* Floating weather text — no background, black */}
      <div className="text-center mb-2 pointer-events-none min-h-[26px]">
        {currentWeather ? (
          <div className="inline-flex items-baseline gap-2 tabular-nums">
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: "#000",
                textShadow: textShadowOnMap,
              }}
            >
              {Math.round(currentWeather.temperature)}°C
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(0,0,0,0.72)",
                textShadow: textShadowOnMap,
              }}
            >
              {currentWeather.windSpeed} m/s
            </span>
          </div>
        ) : weatherLoading ? null : (
          <span
            className="text-xs"
            style={{ color: "#000", textShadow: textShadowOnMap, fontWeight: 600 }}
          >
            {sunCount}/{totalCount} ställen i sol
          </span>
        )}
      </div>

      <div
        className="pointer-events-auto max-w-md mx-auto rounded-2xl"
        style={{
          background: "rgba(255, 255, 255, 0.28)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          border: "0.5px solid rgba(255, 255, 255, 0.45)",
          overflow: "visible",
        }}
      >
        <div className="px-3 pt-1 pb-2.5" style={{ overflow: "visible" }}>
          {/* Weather icons row — selected bigger, may poke above panel top edge */}
          <div
            className="flex items-end mb-1"
            style={{ height: 26, overflow: "visible" }}
          >
            {HOURS.map((h) => {
              const hw = getHourWeather(h);
              const hwSymbol = hw ? getSymbolInfo(hw.symbolCode) : null;
              const isSelected = h === hour;
              const past = isPastHour(h);
              return (
                <div
                  key={h}
                  className="flex-1 flex items-end justify-center transition-all duration-200 ease-out"
                  style={{
                    fontSize: isSelected ? 32 : 14,
                    opacity: isSelected ? 1 : past ? 0.35 : 0.85,
                    filter: past
                      ? "grayscale(1)"
                      : isSelected
                      ? "drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
                      : "none",
                    lineHeight: 1,
                  }}
                >
                  {hwSymbol?.icon ?? "·"}
                </div>
              );
            })}
          </div>

          {/* Draggable gradient slider */}
          <div
            ref={trackRef}
            className="relative select-none touch-none"
            style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Bright sun gradient strip */}
            <div
              className="rounded-full"
              style={{
                height: 28,
                background:
                  "linear-gradient(90deg, rgba(190,195,215,0.75) 0%, rgba(255,220,140,0.9) 22%, rgba(255,245,195,1) 50%, rgba(255,220,140,0.9) 78%, rgba(190,195,215,0.75) 100%)",
                boxShadow:
                  "inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.08)",
              }}
            />

            {/* Hour numbers over gradient */}
            <div className="absolute inset-0 flex items-center pointer-events-none">
              {HOURS.map((h) => {
                const isSelected = h === hour;
                const past = isPastHour(h);
                return (
                  <div
                    key={h}
                    className="flex-1 flex justify-center tabular-nums transition-colors"
                    style={{
                      fontSize: isSelected ? 0 : 10,
                      fontWeight: 700,
                      color: past ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.85)",
                    }}
                  >
                    {h}
                  </div>
                );
              })}
            </div>

            {/* Selected hour orange pill — larger */}
            <div
              className="absolute top-1/2 flex items-center justify-center rounded-full pointer-events-none tabular-nums"
              style={{
                left: `${((hour - 7 + 0.5) / HOURS.length) * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 46,
                height: 46,
                background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                boxShadow:
                  "0 0 28px rgba(251, 146, 60, 0.7), 0 6px 16px rgba(251, 146, 60, 0.5), inset 0 1px 1px rgba(255,255,255,0.3)",
                color: "#000",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                transition: dragging ? "none" : "left 0.22s ease-out",
              }}
            >
              {hour}
            </div>
          </div>

          {/* Day pills */}
          <div className="flex items-stretch gap-1 mt-3">
            {days.map((d, i) => {
              const dStr = toLocalDateStr(d);
              const isSelected = selectedDateStr === dStr;
              const dayName = i === 0 ? "IDAG" : (DAY_NAMES[d.getDay()] ?? "");
              const dateLabel = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
              return (
                <button
                  key={dStr}
                  onClick={() => onDateChange(d)}
                  className="flex-1 rounded-full px-1 py-1 transition-all duration-200 flex flex-col items-center justify-center"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                      : "rgba(255, 255, 255, 0.6)",
                    boxShadow: isSelected ? "0 3px 12px rgba(251, 146, 60, 0.45)" : "none",
                    color: "#000",
                    minWidth: 0,
                  }}
                >
                  <span
                    className="text-[9px] font-bold leading-none"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {dayName}
                  </span>
                  <span
                    className="text-[8.5px] leading-tight mt-0.5 tabular-nums"
                    style={{
                      color: isSelected ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.6)",
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
          <div className="flex items-stretch gap-1 mt-1.5">
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
                  className="flex-1 rounded-full py-1 transition-all duration-200 text-[9px] font-bold tracking-wider"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                      : isCurrent && isInDayRange
                      ? "rgba(251, 146, 60, 0.35)"
                      : "rgba(255, 255, 255, 0.5)",
                    color: "#000",
                    boxShadow: isSelected ? "0 3px 10px rgba(251, 146, 60, 0.4)" : "none",
                    letterSpacing: "0.08em",
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
