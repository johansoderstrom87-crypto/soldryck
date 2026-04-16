"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { type WeatherData, getSymbolInfo } from "../lib/weather";

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

  // Generate 7 days: today + 6 days forward (matches image layout)
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
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

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] p-3 pointer-events-none"
      style={{ fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif" }}
    >
      {/* Floating weather text — no background */}
      <div className="text-center mb-2 pointer-events-none min-h-[28px]">
        {currentWeather ? (
          <div
            className="inline-flex items-baseline gap-2 tabular-nums"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6), 0 0 12px rgba(0,0,0,0.4)" }}
          >
            <span
              className="text-white"
              style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}
            >
              {Math.round(currentWeather.temperature)}°C
            </span>
            <span className="text-white/85" style={{ fontSize: 12, fontWeight: 500 }}>
              {currentWeather.windSpeed} m/s
            </span>
          </div>
        ) : weatherLoading ? null : (
          <span
            className="text-white/85 text-xs"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >
            {sunCount}/{totalCount} ställen i sol
          </span>
        )}
      </div>

      <div
        className="pointer-events-auto max-w-md mx-auto rounded-2xl"
        style={{
          background: "rgba(20, 20, 28, 0.45)",
          backdropFilter: "blur(18px) saturate(1.3)",
          WebkitBackdropFilter: "blur(18px) saturate(1.3)",
          border: "0.5px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="px-3 pt-2 pb-2.5">
          {/* Weather icons row (above gradient) */}
          <div className="flex items-end mb-1" style={{ height: 22 }}>
            {HOURS.map((h) => {
              const hw = weather?.hourly[h];
              const hwSymbol = hw ? getSymbolInfo(hw.symbolCode) : null;
              const isSelected = h === hour;
              return (
                <div
                  key={h}
                  className="flex-1 flex items-end justify-center transition-all duration-200 ease-out"
                  style={{
                    fontSize: isSelected ? 18 : 11,
                    opacity: isSelected ? 1 : 0.6,
                    lineHeight: 1,
                    filter: isSelected ? "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" : "none",
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
            {/* Thin sun gradient strip */}
            <div
              className="rounded-full"
              style={{
                height: 26,
                background:
                  "linear-gradient(90deg, rgba(30,30,50,0.85) 0%, rgba(255,180,80,0.45) 22%, rgba(255,225,150,0.75) 50%, rgba(255,180,80,0.45) 78%, rgba(30,30,50,0.85) 100%)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 1px rgba(0,0,0,0.2)",
              }}
            />

            {/* Hour numbers over gradient */}
            <div className="absolute inset-0 flex items-center pointer-events-none">
              {HOURS.map((h) => {
                const isSelected = h === hour;
                return (
                  <div
                    key={h}
                    className="flex-1 flex justify-center tabular-nums transition-all duration-200"
                    style={{
                      fontSize: isSelected ? 0 : 10,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                    }}
                  >
                    {h}
                  </div>
                );
              })}
            </div>

            {/* Selected hour orange pill */}
            <div
              className="absolute top-1/2 flex items-center justify-center rounded-full pointer-events-none tabular-nums"
              style={{
                left: `${((hour - 7 + 0.5) / HOURS.length) * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 38,
                height: 38,
                background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                boxShadow:
                  "0 0 24px rgba(251, 146, 60, 0.6), 0 4px 14px rgba(251, 146, 60, 0.45), inset 0 1px 1px rgba(255,255,255,0.25)",
                color: "#fff",
                fontSize: 16,
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
              const dStr = d.toISOString().slice(0, 10);
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
                      : "rgba(255, 255, 255, 0.06)",
                    boxShadow: isSelected ? "0 3px 12px rgba(251, 146, 60, 0.4)" : "none",
                    color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.72)",
                    minWidth: 0,
                  }}
                >
                  <span
                    className="text-[9px] font-bold tracking-wider leading-none"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {dayName}
                  </span>
                  <span
                    className="text-[8.5px] leading-tight mt-0.5 tabular-nums"
                    style={{
                      color: isSelected ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.45)",
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
                      ? "rgba(251, 146, 60, 0.18)"
                      : "rgba(255, 255, 255, 0.04)",
                    color: isSelected
                      ? "#fff"
                      : isCurrent && isInDayRange
                      ? "#fdba74"
                      : "rgba(255, 255, 255, 0.55)",
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
