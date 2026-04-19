"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { type WeatherData, type HourlyWeather, getSymbolInfo, toLocalDateStr } from "../lib/weather";
import DirectionGauges from "./DirectionGauges";

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

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22

function toInputDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TimeSlider({
  hour,
  onHourChange,
  date,
  onDateChange,
  weather,
}: TimeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  // baseDate determines the start of the 7-day window; always resets to today on mount
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [baseDate]);

  const realNow = new Date();
  const todayStr = toLocalDateStr(realNow);
  const currentRealHour = realNow.getHours();
  const selectedDateStr = toLocalDateStr(date);
  const displayIsPast = selectedDateStr < todayStr;
  const displayIsToday = selectedDateStr === todayStr;
  const baseDateIsToday = toLocalDateStr(baseDate) === todayStr;

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
      for (let d = 1; d <= 6; d++) {
        if (weather.hourly[h + d]) return weather.hourly[h + d];
        if (weather.hourly[h - d]) return weather.hourly[h - d];
      }
      return null;
    },
    [weather]
  );

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

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split("-").map(Number);
    const picked = new Date(y, m - 1, d);
    picked.setHours(0, 0, 0, 0);
    setBaseDate(picked);
    onDateChange(picked);
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] p-3 pointer-events-none"
      style={{ fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif" }}
    >
      {/* Sun / temp / wind bar */}
      <div className="pointer-events-none mb-1">
        <DirectionGauges hour={hour} date={date} currentWeather={currentWeather} />
      </div>

      {/* Hidden date input for calendar picker */}
      <input
        ref={dateInputRef}
        type="date"
        value={toInputDateStr(baseDate)}
        onChange={handleCalendarChange}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        tabIndex={-1}
      />

      <div
        className="pointer-events-auto max-w-md mx-auto rounded-2xl"
        style={{
          background: "rgba(255, 255, 255, 0.3)",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          border: "0.5px solid rgba(255, 255, 255, 0.45)",
          overflow: "visible",
          transform: "translateZ(0)",
          isolation: "isolate",
        }}
      >
        <div className="px-3 pt-1 pb-2.5" style={{ overflow: "visible" }}>
          {/* Weather icons row */}
          <div className="relative mb-1" style={{ height: 30, overflow: "visible" }}>
            {HOURS.map((h) => {
              const hw = getHourWeather(h);
              const hwSymbol = hw ? getSymbolInfo(hw.symbolCode) : null;
              const isSelected = h === hour;
              const past = isPastHour(h);
              return (
                <div
                  key={h}
                  className="absolute flex items-end justify-center"
                  style={{
                    left: `${((h - 7 + 0.5) / HOURS.length) * 100}%`,
                    bottom: 0,
                    width: 20,
                    marginLeft: -10,
                    fontSize: 14,
                    lineHeight: 1,
                    transform: `scale(${isSelected ? 2.2 : 1})`,
                    transformOrigin: "bottom center",
                    opacity: isSelected ? 1 : past ? 0.35 : 0.85,
                    filter: past
                      ? "grayscale(1)"
                      : isSelected
                      ? "drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
                      : "none",
                    willChange: "transform",
                    transition: "transform 0.22s ease-out, opacity 0.22s ease-out",
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

            {HOURS.map((h) => {
              const isSelected = h === hour;
              const past = isPastHour(h);
              return (
                <div
                  key={h}
                  className="absolute top-1/2 tabular-nums pointer-events-none"
                  style={{
                    left: `${((h - 7 + 0.5) / HOURS.length) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: past ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.85)",
                    opacity: isSelected ? 0 : 1,
                    transition: "opacity 0.15s ease-out, color 0.2s",
                  }}
                >
                  {h}
                </div>
              );
            })}

            <div
              className="absolute flex items-center justify-center rounded-full pointer-events-none tabular-nums"
              style={{
                top: "50%",
                left: 0,
                width: 46,
                height: 46,
                transform: `translate3d(${
                  ((hour - 7 + 0.5) / HOURS.length) * trackWidth - 23
                }px, -50%, 0)`,
                willChange: "transform",
                transition: dragging ? "none" : "transform 0.22s ease-out",
                background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                boxShadow:
                  "0 0 24px rgba(251, 146, 60, 0.65), 0 4px 12px rgba(251, 146, 60, 0.45), inset 0 1px 1px rgba(255,255,255,0.3)",
                color: "#000",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "-0.02em",
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
              const isFirstPill = i === 0;
              const dayName = isFirstPill
                ? baseDateIsToday
                  ? "IDAG"
                  : DAY_NAMES[d.getDay()] ?? ""
                : DAY_NAMES[d.getDay()] ?? "";
              const dateLabel = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
              return (
                <button
                  key={dStr}
                  onClick={() => {
                    if (isFirstPill) {
                      dateInputRef.current?.showPicker?.();
                      dateInputRef.current?.click();
                    } else {
                      onDateChange(d);
                    }
                  }}
                  className="flex-1 rounded-full px-1 py-1 transition-all duration-200 flex flex-col items-center justify-center"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                      : isFirstPill
                      ? "rgba(255, 255, 255, 0.75)"
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
                    {isFirstPill && (
                      <span style={{ marginLeft: 2, opacity: 0.55, fontSize: 8 }}>▾</span>
                    )}
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
        </div>
      </div>
    </div>
  );
}
