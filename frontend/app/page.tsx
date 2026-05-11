"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import TimeSlider from "./components/TimeSlider";
import Header from "./components/Header";
import FeedbackModal from "./components/FeedbackModal";
import SplashScreen from "./components/SplashScreen";
import { fetchWeather, toLocalDateStr, type WeatherData } from "./lib/weather";
import type { FeedbackVenue } from "./components/SunMap";
import type { VenueType, SunRange } from "./components/SunMap";
import type { MetroStation } from "./data/metro-stations";

// Mock baseline data — tiny (8 venues), safe to keep in the main bundle as
// a fallback so the UI renders something while venues-computed downloads
// (or if the dynamic import fails altogether).
const mockData = require("./data/mock-venues");
type VenueModule = typeof import("./data/venues-computed");

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
  const [showMetro, setShowMetro] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<VenueType>>(new Set());
  const [sunRange, setSunRange] = useState<SunRange>(null);
  const [focusVenueId, setFocusVenueId] = useState<string | null>(initialVenue);
  const [metroStation, setMetroStation] = useState<MetroStation | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  // Lazy-load the ~5.5 MB venues-computed module. Keeping it out of the main
  // bundle lets older phones become interactive in ~2 s instead of waiting
  // 10–15 s for the full payload to download + JS-parse. The mock fallback
  // (8 venues) provides a baseline while the real data is in flight.
  const [venueData, setVenueData] = useState<VenueModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("./data/venues-computed")
      .then((m) => { if (!cancelled) setVenueData(m as unknown as VenueModule); })
      .catch(() => { /* keep mockData fallback */ });
    return () => { cancelled = true; };
  }, []);

  const allVenues = venueData?.venues ?? mockData.mockVenues;
  const getDateKey = venueData?.getClosestDateKey ?? mockData.getClosestDateKey;
  const getStatus = venueData?.getVenueStatus ?? mockData.getVenueStatus;

  const dateKey = useMemo(() => getDateKey(date), [date, getDateKey]);
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
    [dateKey, hour, allVenues, getStatus]
  );

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather()
      .then((data) => setWeather(data))
      .finally(() => setWeatherLoading(false));
  }, []);

  return (
    <div className="h-full relative">
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <Header
        filter={filter}
        onFilterChange={setFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sunRange={sunRange}
        onSunRangeChange={setSunRange}
        showShadows={showShadows}
        onToggleShadows={() => setShowShadows((s) => !s)}
        showMetro={showMetro}
        onToggleMetro={() => setShowMetro((s) => !s)}
        metroStation={metroStation}
        onMetroStationChange={setMetroStation}
        venues={allVenues}
        onSelectVenue={(id) => setFocusVenueId(id)}
        hour={hour}
        dateKey={dateKey}
        getStatus={getStatus}
      />

      <SunMap hour={hour} date={date} filter={filter} typeFilter={typeFilter} sunRange={sunRange} weather={weatherForDate} onFeedback={setFeedbackVenue} showShadows={showShadows} showMetro={showMetro} focusVenueId={focusVenueId} onFocusHandled={() => setFocusVenueId(null)} metroStation={metroStation} />

      <TimeSlider
        hour={hour}
        onHourChange={setHour}
        date={date}
        onDateChange={setDate}
        weather={weatherForDate}
        weatherLoading={weatherLoading}
        sunCount={sunCount}
        totalCount={allVenues.length}
        sunRange={sunRange}
        onSunRangeChange={setSunRange}
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
