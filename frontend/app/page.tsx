"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import TimeSlider from "./components/TimeSlider";
import Header from "./components/Header";
import FeedbackModal from "./components/FeedbackModal";
import DirectionGauges from "./components/DirectionGauges";
import { fetchWeather, toLocalDateStr, type WeatherData } from "./lib/weather";
import type { FeedbackVenue } from "./components/SunMap";
import type { VenueType, SunRange } from "./components/SunMap";
import type { MetroStation } from "./data/metro-stations";

// Try computed data first, fall back to mock
let venueData: typeof import("./data/venues-computed") | null = null;
try {
  venueData = require("./data/venues-computed");
} catch {
  // venues-computed.ts doesn't exist yet
}

const mockData = require("./data/mock-venues");

const allVenues = venueData?.venues ?? mockData.mockVenues;
const getDateKey = venueData?.getClosestDateKey ?? mockData.getClosestDateKey;
const getStatus = venueData?.getVenueStatus ?? mockData.getVenueStatus;

const SunMap = dynamic(() => import("./components/SunMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50">
      <div className="text-slate-400 text-sm">Laddar karta...</div>
    </div>
  ),
});

export default function Home() {
  const now = new Date();

  // Parse URL params for shared links
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialHour = urlParams?.get("hour") ? Number(urlParams.get("hour")) : Math.min(Math.max(now.getHours(), 7), 22);
  const initialVenue = urlParams?.get("venue") ?? null;

  const [hour, setHour] = useState(initialHour);
  const [date, setDate] = useState(now);
  const [filter, setFilter] = useState<"all" | "sun" | "shade">("all");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [feedbackVenue, setFeedbackVenue] = useState<FeedbackVenue | null>(null);
  const [showShadows, setShowShadows] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<VenueType>>(new Set());
  const [sunRange, setSunRange] = useState<SunRange>(null);
  const [focusVenueId, setFocusVenueId] = useState<string | null>(initialVenue);
  const [metroStation, setMetroStation] = useState<MetroStation | null>(null);

  const dateKey = useMemo(() => getDateKey(date), [date]);
  const dateStr = useMemo(() => toLocalDateStr(date), [date]);

  // Weather for the selected date
  const weatherForDate = useMemo(() => {
    if (!weather) return null;
    const dayWeather = weather.daily?.[dateStr];
    if (!dayWeather) return null;
    return { ...weather, hourly: dayWeather } as typeof weather;
  }, [weather, dateStr]);

  const sunCount = useMemo(
    () =>
      allVenues.filter(
        (v: any) => {
          const s = getStatus(v, dateKey, hour);
          return s === "sun" || s === "s";
        }
      ).length,
    [dateKey, hour]
  );

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather()
      .then((data) => setWeather(data))
      .finally(() => setWeatherLoading(false));
  }, []);

  const toggleType = useCallback((type: VenueType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const TYPE_BUTTONS: { type: VenueType; label: string; svg: string }[] = [
    {
      type: "restaurant",
      label: "Restaurang",
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
    },
    {
      type: "cafe",
      label: "Café",
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
    },
    {
      type: "bar",
      label: "Bar",
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
    },
    {
      type: "pub",
      label: "Pub",
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M5 11h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M12 2v4"/><path d="M8 4l1-2"/><path d="M16 4l-1-2"/></svg>`,
    },
  ];

  return (
    <div className="h-full relative">
      <Header
        filter={filter}
        onFilterChange={setFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sunRange={sunRange}
        onSunRangeChange={setSunRange}
        showShadows={showShadows}
        onToggleShadows={() => setShowShadows((s) => !s)}
        metroStation={metroStation}
        onMetroStationChange={setMetroStation}
        venues={allVenues}
        onSelectVenue={(id) => setFocusVenueId(id)}
      />

      {/* Venue type quick-filter icons — left edge */}
      <div className="absolute left-3 z-[1000] flex flex-col gap-2 pointer-events-auto" style={{ top: "50%", transform: "translateY(-65%)" }}>
        {TYPE_BUTTONS.map(({ type, label, svg }) => {
          const active = typeFilter.size === 0 || typeFilter.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              title={label}
              className="rounded-xl transition-all duration-200"
              style={{
                width: 42,
                height: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: active
                  ? "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)"
                  : "rgba(255,255,255,0.55)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: active
                  ? "1px solid rgba(251,146,60,0.5)"
                  : "1px solid rgba(255,255,255,0.5)",
                boxShadow: active
                  ? "0 4px 14px rgba(251,146,60,0.45)"
                  : "0 2px 8px rgba(0,0,0,0.1)",
                color: active ? "#fff" : "#666",
                opacity: active ? 1 : 0.7,
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          );
        })}
      </div>

      {/* Direction gauges — right edge */}
      <div className="absolute right-3 z-[1000] pointer-events-auto" style={{ top: "50%", transform: "translateY(-65%)" }}>
        <DirectionGauges hour={hour} date={date} weather={weatherForDate} />
      </div>

      <SunMap hour={hour} date={date} filter={filter} typeFilter={typeFilter} sunRange={sunRange} weather={weatherForDate} onFeedback={setFeedbackVenue} showShadows={showShadows} focusVenueId={focusVenueId} onFocusHandled={() => setFocusVenueId(null)} metroStation={metroStation} />

      <TimeSlider
        hour={hour}
        onHourChange={setHour}
        date={date}
        onDateChange={setDate}
        weather={weatherForDate}
        weatherLoading={weatherLoading}
        sunCount={sunCount}
        totalCount={allVenues.length}
      />

      {feedbackVenue && (
        <FeedbackModal
          venue={feedbackVenue}
          onClose={() => setFeedbackVenue(null)}
        />
      )}
    </div>
  );
}
