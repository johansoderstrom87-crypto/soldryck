"use client";

import { useState, useCallback, useMemo } from "react";

interface TimeSliderProps {
  hour: number;
  onHourChange: (hour: number) => void;
  date: Date;
  onDateChange: (date: Date) => void;
}

const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTH_NAMES_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export default function TimeSlider({
  hour,
  onHourChange,
  date,
  onDateChange,
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    let currentHour = hour;
    const interval = setInterval(() => {
      currentHour++;
      if (currentHour > 22) {
        clearInterval(interval);
        setIsPlaying(false);
        return;
      }
      onHourChange(currentHour);
    }, 800);
    return () => clearInterval(interval);
  }, [hour, isPlaying, onHourChange]);

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

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Time slider */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handlePlay}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors shadow-sm"
            title={isPlaying ? "Pausa" : "Spela upp"}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="0" width="4" height="14" rx="1" />
                <rect x="9" y="0" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 0.5L13 7L2 13.5V0.5Z" />
              </svg>
            )}
          </button>

          <div className="flex-1 flex flex-col gap-1">
            <input
              type="range"
              min={8}
              max={22}
              step={1}
              value={hour}
              onChange={(e) => onHourChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between px-0.5">
              {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                <span
                  key={h}
                  className={`text-[10px] tabular-nums ${
                    h === hour
                      ? "text-amber-600 font-bold"
                      : "text-slate-400"
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 text-right min-w-[48px]">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {String(hour).padStart(2, "0")}
            </span>
            <span className="text-lg text-slate-400">:00</span>
          </div>
        </div>

        {/* Day selector */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
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
      </div>
    </div>
  );
}
