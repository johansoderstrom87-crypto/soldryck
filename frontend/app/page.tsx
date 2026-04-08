"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import TimeSlider from "./components/TimeSlider";
import Header from "./components/Header";

// Try computed data first, fall back to mock
let venueData: typeof import("./data/venues-computed") | null = null;
try {
  venueData = require("./data/venues-computed");
} catch {
  // venues-computed.ts doesn't exist yet — use mock data
}

const mockData = require("./data/mock-venues");

const allVenues = venueData?.venues ?? mockData.mockVenues;
const getDateKey = venueData?.getClosestDateKey ?? mockData.getClosestDateKey;
const getStatus = venueData?.getVenueStatus ?? mockData.getVenueStatus;

// Leaflet must be loaded client-side only
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
  const [hour, setHour] = useState(Math.min(Math.max(now.getHours(), 8), 22));
  const [date, setDate] = useState(now);
  const [filter, setFilter] = useState<"all" | "sun" | "shade">("all");

  const dateKey = useMemo(() => getDateKey(date), [date]);

  const sunCount = useMemo(
    () =>
      allVenues.filter(
        (v: any) => getStatus(v, dateKey, hour) === "sun" || getStatus(v, dateKey, hour) === "s"
      ).length,
    [dateKey, hour]
  );

  return (
    <div className="h-full relative">
      <Header
        filter={filter}
        onFilterChange={setFilter}
        sunCount={sunCount}
        totalCount={allVenues.length}
      />

      <SunMap hour={hour} date={date} filter={filter} />

      <TimeSlider
        hour={hour}
        onHourChange={setHour}
        date={date}
        onDateChange={setDate}
      />
    </div>
  );
}
