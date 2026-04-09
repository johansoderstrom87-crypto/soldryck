"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import TimeSlider from "./components/TimeSlider";
import Header from "./components/Header";
import FeedbackModal from "./components/FeedbackModal";
import { fetchWeather, type WeatherData } from "./lib/weather";
import type { FeedbackVenue } from "./components/SunMap";
import type { VenueType } from "./components/SunMap";

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
  const [hour, setHour] = useState(Math.min(Math.max(now.getHours(), 7), 22));
  const [date, setDate] = useState(now);
  const [filter, setFilter] = useState<"all" | "sun" | "shade">("all");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [feedbackVenue, setFeedbackVenue] = useState<FeedbackVenue | null>(null);
  const [showShadows, setShowShadows] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<VenueType>>(new Set());

  const dateKey = useMemo(() => getDateKey(date), [date]);

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

  return (
    <div className="h-full relative">
      <Header
        filter={filter}
        onFilterChange={setFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sunCount={sunCount}
        totalCount={allVenues.length}
        weather={weather}
        weatherLoading={weatherLoading}
        hour={hour}
        showShadows={showShadows}
        onToggleShadows={() => setShowShadows((s) => !s)}
      />

      <SunMap hour={hour} date={date} filter={filter} typeFilter={typeFilter} weather={weather} onFeedback={setFeedbackVenue} showShadows={showShadows} />

      <TimeSlider
        hour={hour}
        onHourChange={setHour}
        date={date}
        onDateChange={setDate}
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
