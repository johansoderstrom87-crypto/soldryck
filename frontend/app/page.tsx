"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import TimeSlider from "./components/TimeSlider";
import Header from "./components/Header";
import FeedbackModal from "./components/FeedbackModal";
import FeedbackButton from "./components/FeedbackButton";
import SplashScreen from "./components/SplashScreen";
import Onboarding from "./components/Onboarding";
import OffSeasonBanner from "./components/OffSeasonBanner";
import IosInstallHint from "./components/IosInstallHint";
import VenuesLoadingPill from "./components/VenuesLoadingPill";
import { fetchWeather, toLocalDateStr, type WeatherData } from "./lib/weather";
import { isInSeason, snapToSeason } from "./lib/season";
import { getTimeTheme, applyTimeTheme } from "./lib/timeTheme";
import { track, installGlobalErrorHandlers } from "./lib/analytics";
import type { FeedbackVenue } from "./components/SunMap";
import type { VenueType, SunRange } from "./components/SunMap";
import type { MetroStation } from "./data/metro-stations";

// Mock baseline data — tiny (8 venues), safe to keep in the main bundle as
// a fallback so the UI renders something while the JSON payload downloads
// (or if the fetch fails altogether).
const mockData = require("./data/mock-venues");
import {
  getClosestDateKey as computedGetDateKey,
  getVenueStatus as computedGetStatus,
  type ComputedVenue,
} from "./data/venues-computed";
import { setVenues, getVenues } from "./data/venues-store";

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
  // Pipeline only computes shadow data for April–October. Outside that window
  // every venue would render grey, making the app look broken to a winter
  // visitor. Snap forward to the next April 1 so the demo always works; the
  // OffSeasonBanner explains the jump.
  const offSeason = !isInSeason(now);
  const initialDate = snapToSeason(now);

  // Parse URL params for shared links
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialHour = urlParams?.get("hour") ? Number(urlParams.get("hour")) : Math.min(Math.max(now.getHours(), 7), 22);
  const initialVenue = urlParams?.get("venue") ?? null;

  const [hour, setHour] = useState(initialHour);
  const [date, setDate] = useState(initialDate);
  const [filter, setFilter] = useState<"all" | "sun" | "shade">("all");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [feedbackVenue, setFeedbackVenue] = useState<FeedbackVenue | null>(null);
  const [showShadows, setShowShadows] = useState(false);
  const [showMetro, setShowMetro] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  // Default — Äta, Bar och Takbar påslagna (Fika av). Användartesterna
  // visade att caféer dominerade datasetet och skymde de mer aktiva
  // ute-/kvällsplatserna som flest letar efter. Tom uppsättning betyder
  // "inget av kategorierna är på" och döljer alla venues; det är
  // knapparnas själva urval, inte en extramodifier ovanpå "allt".
  const [typeFilter, setTypeFilter] = useState<Set<VenueType>>(
    () => new Set<VenueType>(["restaurant", "bar", "rooftop"]),
  );
  const [sunRange, setSunRange] = useState<SunRange>(null);
  const [focusVenueId, setFocusVenueId] = useState<string | null>(initialVenue);
  const [metroStation, setMetroStation] = useState<MetroStation | null>(null);
  const [openNowFilter, setOpenNowFilter] = useState(false);
  const [alcoholOnly, setAlcoholOnly] = useState(false);
  const [dogFriendlyOnly, setDogFriendlyOnly] = useState(false);
  const [glutenFreeOnly, setGlutenFreeOnly] = useState(false);
  // Splash is skipped for users who already added Soldryck to the home
  // screen — they saw it on first install. Initial state must be false so
  // the server render matches the first client render (no hydration
  // mismatch warning); the standalone check happens in the effect below
  // so a re-render flips splashDone before any meaningful paint.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isPWA =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isPWA) setSplashDone(true);

    // One-shot page-view + global error capture. Anonymous (no userId) and
    // gated on Do-Not-Track via lib/analytics. Cleanup uninstalls listeners
    // on unmount — irrelevant in production but keeps Strict Mode happy.
    track("page_view", { pwa: isPWA, off_season: offSeason });
    return installGlobalErrorHandlers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the ~6 MB venues JSON payload separately from the main JS bundle.
  // The previous implementation imported the data as a TS module; that meant
  // every page load shipped the array as JavaScript (slow to parse on phones)
  // and webpack couldn't gzip it as effectively as raw JSON. Now the bundle
  // ships only the helpers + type definitions, and we hydrate the store
  // from `/data/venues-computed.json` on mount.
  //
  // While the JSON is in flight, SunMap renders the 8-venue mock fallback
  // (kept in the main bundle for instant first paint), and VenuesLoadingPill
  // shows ambient progress to the user.
  const [venuesLoaded, setVenuesLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/data/venues-computed.json")
      .then((r) => r.ok ? r.json() : null)
      .then((data: ComputedVenue[] | null) => {
        if (cancelled || !data) return;
        setVenues(data);
        setVenuesLoaded(true);
      })
      .catch(() => { /* mock fallback remains in the store sentinel */ });
    return () => { cancelled = true; };
  }, []);

  const allVenues = venuesLoaded ? getVenues() : (mockData.mockVenues as unknown as ComputedVenue[]);
  const getDateKey = venuesLoaded ? computedGetDateKey : mockData.getClosestDateKey;
  const getStatus = venuesLoaded ? computedGetStatus : mockData.getVenueStatus;

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
        (v: ComputedVenue) => {
          // Mock data uses legacy "sun"; JSON store uses compressed "s".
          const s = getStatus(v, dateKey, hour) as string;
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

  // Time-travel UI — när användaren scrubbar tidslinjen skiftar hela
  // chrome:t (Header-card, TimeSlider, WeatherBar) och kartans tonade
  // overlay mellan dagsljus, gyllene timme och dark mode. Skriver CSS-
  // vars på :root så komponenterna bara läser dem via `var(--theme-…)`.
  useEffect(() => {
    applyTimeTheme(getTimeTheme(hour, date));
  }, [hour, date]);

  return (
    <div className="h-full relative">
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <Onboarding ready={splashDone} />
      {offSeason && splashDone && <OffSeasonBanner snappedDate={initialDate} />}
      {splashDone && <IosInstallHint />}
      {splashDone && <VenuesLoadingPill loading={!venuesLoaded} />}
      {splashDone && <FeedbackButton />}
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
        showRain={showRain}
        onToggleRain={() => setShowRain((s) => !s)}
        wheelchairOnly={wheelchairOnly}
        onWheelchairOnlyChange={setWheelchairOnly}
        dogFriendlyOnly={dogFriendlyOnly}
        onDogFriendlyOnlyChange={setDogFriendlyOnly}
        glutenFreeOnly={glutenFreeOnly}
        onGlutenFreeOnlyChange={setGlutenFreeOnly}
        metroStation={metroStation}
        onMetroStationChange={setMetroStation}
        openNowFilter={openNowFilter}
        onOpenNowFilterChange={setOpenNowFilter}
        alcoholOnly={alcoholOnly}
        onAlcoholOnlyChange={setAlcoholOnly}
        venues={allVenues}
        onSelectVenue={(id) => setFocusVenueId(id)}
        hour={hour}
        dateKey={dateKey}
        getStatus={getStatus}
        getClosestDateKey={getDateKey}
      />

      <SunMap hour={hour} date={date} filter={filter} typeFilter={typeFilter} sunRange={sunRange} weather={weatherForDate} onFeedback={setFeedbackVenue} onSetHour={setHour} showShadows={showShadows} showMetro={showMetro} showRain={showRain} focusVenueId={focusVenueId} onFocusHandled={() => setFocusVenueId(null)} metroStation={metroStation} openNowFilter={openNowFilter} alcoholOnly={alcoholOnly} wheelchairOnly={wheelchairOnly} dogFriendlyOnly={dogFriendlyOnly} glutenFreeOnly={glutenFreeOnly} />

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
