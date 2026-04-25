"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { type WeatherData, type HourlyWeather, getSymbolInfo, toLocalDateStr } from "../lib/weather";
import DirectionGauges from "./DirectionGauges";

type SunRange = { from: number; to: number } | null;

interface TimeSliderProps {
  hour: number;
  onHourChange: (hour: number) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  weather: WeatherData | null;
  weatherLoading: boolean;
  sunCount: number;
  totalCount: number;
  sunRange: SunRange;
  onSunRangeChange: (r: SunRange) => void;
}

const DAY_NAMES = ["SÖN", "MÅN", "TIS", "ONS", "TOR", "FRE", "LÖR"];
const DAY_NAMES_FULL = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTH_NAMES_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTH_NAMES_FULL = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22

// --- Custom calendar popup ---
interface CalendarProps {
  value: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

function Calendar({ value, onSelect, onClose }: CalendarProps) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);
  const selectedStr = toLocalDateStr(value);

  const firstDay = new Date(viewYear, viewMonth, 1);
  // Week starts Monday: shift sunday (0) to 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 0,
        right: 0,
        zIndex: 10,
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        border: "0.5px solid rgba(255, 255, 255, 0.7)",
        borderRadius: 20,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        padding: "12px 10px 10px",
        fontFamily: "inherit",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Month / year header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={prevMonth}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.75)",
            border: "0.5px solid rgba(255,255,255,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "rgba(0,0,0,0.7)", cursor: "pointer",
          }}
        >‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "rgba(0,0,0,0.85)" }}>
          {MONTH_NAMES_FULL[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.75)",
            border: "0.5px solid rgba(255,255,255,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "rgba(0,0,0,0.7)", cursor: "pointer",
          }}
        >›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAY_NAMES_FULL.slice(1).concat(DAY_NAMES_FULL[0]).map(n => (
          <div key={n} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.4)", letterSpacing: "0.06em", padding: "2px 0" }}>
            {n.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const dStr = toLocalDateStr(d);
          const isSelected = dStr === selectedStr;
          const isToday = dStr === todayStr;
          return (
            <button
              key={dStr}
              onClick={() => { onSelect(d); onClose(); }}
              style={{
                borderRadius: 8,
                height: 30,
                fontSize: 11,
                fontWeight: isSelected || isToday ? 700 : 500,
                cursor: "pointer",
                background: isSelected
                  ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                  : isToday
                  ? "rgba(251, 146, 60, 0.25)"
                  : "rgba(255,255,255,0.65)",
                color: isSelected ? "#fff" : "rgba(0,0,0,0.8)",
                border: isToday && !isSelected ? "1px solid rgba(251,146,60,0.5)" : "none",
                boxShadow: isSelected ? "0 2px 8px rgba(251,146,60,0.4)" : "none",
                transition: "background 0.15s, transform 0.1s",
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div style={{ marginTop: 8, textAlign: "center" }}>
        <button
          onClick={() => { onSelect(today); onClose(); }}
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            padding: "4px 14px", borderRadius: 20,
            background: "rgba(255,255,255,0.75)",
            border: "0.5px solid rgba(255,255,255,0.85)",
            color: "rgba(0,0,0,0.65)", cursor: "pointer",
          }}
        >
          IDAG
        </button>
      </div>
    </div>
  );
}

export default function TimeSlider({
  hour,
  onHourChange,
  date,
  onDateChange,
  weather,
  sunRange,
  onSunRangeChange,
}: TimeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<"from" | "to" | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const rangeMode = sunRange !== null;

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

  // Close calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calendarOpen]);

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

  const clientXToHour = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return hour;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return HOURS[Math.round(ratio * (HOURS.length - 1))] ?? hour;
  }, [hour]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    const h = clientXToHour(e.clientX);
    if (rangeMode && sunRange) {
      const distFrom = Math.abs(h - sunRange.from);
      const distTo = Math.abs(h - sunRange.to);
      const handle = distFrom <= distTo ? "from" : "to";
      setDraggingHandle(handle);
      if (handle === "from") {
        const newFrom = Math.min(h, sunRange.to - 1);
        onSunRangeChange({ from: newFrom, to: sunRange.to });
        onHourChange(newFrom);
      } else {
        onSunRangeChange({ from: sunRange.from, to: Math.max(h, sunRange.from + 1) });
      }
    } else {
      if (h !== hour) onHourChange(h);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const h = clientXToHour(e.clientX);
    if (rangeMode && sunRange && draggingHandle) {
      if (draggingHandle === "from") {
        const newFrom = Math.min(h, sunRange.to - 1);
        if (newFrom !== sunRange.from) { onSunRangeChange({ from: newFrom, to: sunRange.to }); onHourChange(newFrom); }
      } else {
        const newTo = Math.max(h, sunRange.from + 1);
        if (newTo !== sunRange.to) onSunRangeChange({ from: sunRange.from, to: newTo });
      }
    } else if (!rangeMode) {
      if (h !== hour) onHourChange(h);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    setDragging(false);
    setDraggingHandle(null);
  };

  const handleCalendarSelect = (picked: Date) => {
    picked.setHours(0, 0, 0, 0);
    setBaseDate(picked);
    onDateChange(picked);
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] p-3 pointer-events-none"
      style={{ fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif" }}
    >
      {/* Sun / temp / wind bar + range toggle button */}
      <div className="max-w-md mx-auto mb-1 flex items-center gap-2">
        <button
          onClick={() => {
            if (rangeMode) {
              onSunRangeChange(null);
            } else {
              const from = hour;
              const to = Math.min(hour + 3, 22);
              onSunRangeChange({ from, to });
            }
          }}
          title={rangeMode ? "Visa enstaka timme" : "Filtrera på soltimmar"}
          className="pointer-events-auto flex-shrink-0 rounded-xl flex items-center justify-center transition-all"
          style={{
            width: 36,
            height: 36,
            background: rangeMode
              ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
              : "rgba(255,255,255,0.28)",
            backdropFilter: rangeMode ? undefined : "blur(14px) saturate(1.3)",
            WebkitBackdropFilter: rangeMode ? undefined : "blur(14px) saturate(1.3)",
            border: rangeMode ? "0.5px solid rgba(255,180,80,0.6)" : "0.5px solid rgba(255,255,255,0.55)",
            boxShadow: rangeMode
              ? "0 0 18px rgba(251,146,60,0.55), 0 3px 8px rgba(251,146,60,0.4), inset 0 1px 1px rgba(255,255,255,0.3)"
              : "0 2px 8px rgba(0,0,0,0.08)",
            color: rangeMode ? "#000" : "#64748b",
          }}
        >
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="3" cy="5" r="3" fill="currentColor" />
            <line x1="6" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="15" cy="5" r="3" fill="currentColor" />
          </svg>
        </button>
        <div className="flex-1 pointer-events-none">
          <DirectionGauges hour={hour} date={date} currentWeather={currentWeather} />
        </div>
      </div>

      <div
        ref={panelRef}
        className="pointer-events-auto max-w-md mx-auto rounded-2xl"
        style={{
          background: "rgba(255, 255, 255, 0.3)",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          border: "0.5px solid rgba(255, 255, 255, 0.45)",
          overflow: "visible",
          transform: "translateZ(0)",
          isolation: "isolate",
          position: "relative",
        }}
      >
        {/* Calendar popup — anchored to panel, opens upward */}
        {calendarOpen && (
          <Calendar
            value={baseDate}
            onSelect={handleCalendarSelect}
            onClose={() => setCalendarOpen(false)}
          />
        )}

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
              const hidden = rangeMode
                ? h === sunRange?.from || h === sunRange?.to
                : h === hour;
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
                    opacity: hidden ? 0 : 1,
                    transition: "opacity 0.15s ease-out, color 0.2s",
                  }}
                >
                  {h}
                </div>
              );
            })}

            {rangeMode && sunRange ? (
              <>
                {/* Highlight strip between handles */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: 0,
                    height: "100%",
                    left: `${((sunRange.from - 7 + 0.5) / HOURS.length) * 100}%`,
                    right: `${100 - ((sunRange.to - 7 + 0.5) / HOURS.length) * 100}%`,
                    background: "rgba(251,146,60,0.22)",
                    borderRadius: 4,
                  }}
                />
                {/* From handle */}
                <div
                  className="absolute flex items-center justify-center rounded-full pointer-events-none tabular-nums"
                  style={{
                    top: "50%",
                    left: 0,
                    width: 40,
                    height: 40,
                    transform: `translate3d(${((sunRange.from - 7 + 0.5) / HOURS.length) * trackWidth - 20}px, -50%, 0)`,
                    willChange: "transform",
                    transition: draggingHandle === "from" ? "none" : "transform 0.15s ease-out",
                    background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                    boxShadow: "0 0 18px rgba(251,146,60,0.6), 0 3px 8px rgba(251,146,60,0.4), inset 0 1px 1px rgba(255,255,255,0.3)",
                    color: "#000",
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {sunRange.from}
                </div>
                {/* To handle */}
                <div
                  className="absolute flex items-center justify-center rounded-full pointer-events-none tabular-nums"
                  style={{
                    top: "50%",
                    left: 0,
                    width: 40,
                    height: 40,
                    transform: `translate3d(${((sunRange.to - 7 + 0.5) / HOURS.length) * trackWidth - 20}px, -50%, 0)`,
                    willChange: "transform",
                    transition: draggingHandle === "to" ? "none" : "transform 0.15s ease-out",
                    background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                    boxShadow: "0 0 18px rgba(251,146,60,0.6), 0 3px 8px rgba(251,146,60,0.4), inset 0 1px 1px rgba(255,255,255,0.3)",
                    color: "#000",
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {sunRange.to}
                </div>
              </>
            ) : (
              <div
                className="absolute flex items-center justify-center rounded-full pointer-events-none tabular-nums"
                style={{
                  top: "50%",
                  left: 0,
                  width: 46,
                  height: 46,
                  transform: `translate3d(${((hour - 7 + 0.5) / HOURS.length) * trackWidth - 23}px, -50%, 0)`,
                  willChange: "transform",
                  transition: dragging ? "none" : "transform 0.22s ease-out",
                  background: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
                  boxShadow: "0 0 24px rgba(251,146,60,0.65), 0 4px 12px rgba(251,146,60,0.45), inset 0 1px 1px rgba(255,255,255,0.3)",
                  color: "#000",
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                }}
              >
                {hour}
              </div>
            )}
          </div>

          {/* Day pills */}
          <div className="flex items-stretch gap-1 mt-3">
            {days.map((d, i) => {
              const dStr = toLocalDateStr(d);
              const isSelected = selectedDateStr === dStr;
              const isFirstPill = i === 0;
              const dayName = isFirstPill
                ? baseDateIsToday ? "IDAG" : DAY_NAMES[d.getDay()] ?? ""
                : DAY_NAMES[d.getDay()] ?? "";
              const dateLabel = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
              return (
                <button
                  key={dStr}
                  onClick={() => {
                    if (isFirstPill) {
                      setCalendarOpen(o => !o);
                    } else {
                      setCalendarOpen(false);
                      onDateChange(d);
                    }
                  }}
                  className="flex-1 rounded-full px-1 py-1 transition-all duration-200 flex flex-col items-center justify-center"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                      : calendarOpen && isFirstPill
                      ? "rgba(251, 146, 60, 0.2)"
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
