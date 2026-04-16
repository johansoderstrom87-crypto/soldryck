"use client";

import { useEffect, useRef, useMemo, useCallback, useDeferredValue } from "react";
import L from "leaflet";

// Load computed data if available, otherwise mock
let venueModule: any;
try {
  venueModule = require("../data/venues-computed");
} catch {
  venueModule = require("../data/mock-venues");
}

import { type WeatherData, getSymbolInfo, getCombinedStatus } from "../lib/weather";
import { METRO_STATIONS, type MetroStation, STATION_RADIUS_M, distanceM } from "../data/metro-stations";
import { getFavorites, toggleFavorite } from "../lib/favorites";

export interface FeedbackVenue {
  id: string;
  name: string;
  type: string;
  currentSchedule: Record<number, "sun" | "shade" | "night">;
}

export const VENUE_TYPES = ["restaurant", "cafe", "bar", "pub"] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export type SunRange = { from: number; to: number } | null;

interface SunMapProps {
  hour: number;
  date: Date;
  filter: "all" | "sun" | "shade";
  typeFilter: Set<VenueType>;
  sunRange: SunRange;
  weather: WeatherData | null;
  onFeedback?: (venue: FeedbackVenue) => void;
  showShadows?: boolean;
  focusVenueId?: string | null;
  onFocusHandled?: () => void;
  metroStation?: MetroStation | null;
}

type NormalizedStatus = "sun" | "shade" | "partial" | "night";

/** Normalize status from both formats: mock ("sun"/"shade") and computed ("s"/"d") */
function normalize(status: string): NormalizedStatus {
  switch (status) {
    case "sun": case "s": return "sun";
    case "shade": case "d": return "shade";
    case "partial": case "p": return "partial";
    case "night": case "n": return "night";
    default: return "shade";
  }
}

function statusToLabel(s: NormalizedStatus): string {
  return { sun: "Sol", partial: "Delvis sol", shade: "Skugga", night: "Natt" }[s];
}

function statusToEmoji(s: NormalizedStatus): string {
  return { sun: "\u2600\uFE0F", partial: "\u26C5", shade: "\uD83C\uDF25\uFE0F", night: "\uD83C\uDF19" }[s];
}

function typeToLabel(type: string): string {
  return { restaurant: "Restaurang", cafe: "Café", bar: "Bar", pub: "Pub" }[type] ?? type;
}

function typeToSvgIcon(type: string): string {
  const icons: Record<string, string> = {
    restaurant: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
    cafe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
    bar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
    pub: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
  };
  return icons[type] ?? "";
}

function getSunPeriod(venue: any, dateKey: string): string {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  let first = -1;
  let last = -1;
  for (const h of hours) {
    const s = normalize(getStatus(venue, dateKey, h));
    if (s === "sun") {
      if (first === -1) first = h;
      last = h;
    }
  }
  if (first === -1) return "Ingen sol";
  if (first === last) return `Sol kl ${first}`;
  return `Sol ${first}–${last}`;
}

/** Find the best hour today: sun + best weather. Returns { hour, label } or null. */
function getBestHour(venue: any, dateKey: string, weather: WeatherData | null): { hour: number; label: string } | null {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  let bestHour = -1;
  let bestScore = -1;

  for (const h of hours) {
    const s = normalize(getStatus(venue, dateKey, h));
    if (s !== "sun") continue;

    // Score: sun = base 10, weather bonus
    let score = 10;
    if (weather?.hourly[h]) {
      const sym = weather.hourly[h].symbolCode;
      if (sym <= 2) score += 5;       // clear sky
      else if (sym <= 4) score += 2;  // partly cloudy
      else if (sym >= 8) score -= 10; // rain/thunder — disqualify

      // Prefer comfortable temps (18-24)
      const temp = weather.hourly[h].temperature;
      if (temp >= 18 && temp <= 24) score += 3;
      else if (temp >= 15 && temp <= 27) score += 1;

      // Penalize strong wind
      if (weather.hourly[h].windSpeed > 8) score -= 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestHour = h;
    }
  }

  if (bestHour === -1) return null;

  const w = weather?.hourly[bestHour];
  let label = `Kl ${bestHour}:00`;
  if (w) {
    const sym = getSymbolInfo(w.symbolCode);
    label += ` — ${sym.icon} ${Math.round(w.temperature)}\u00b0C`;
  }
  return { hour: bestHour, label };
}

const getDateKey = venueModule.getClosestDateKey;
const getStatus = venueModule.getVenueStatus ?? venueModule.getVenueStatus;
const getSunHrs = venueModule.getSunHours;
const allVenues = venueModule.venues ?? venueModule.mockVenues;

// Badge collision detection — estimate badge bounding boxes in pixel space
// and reassign positions (above/right/left/below) to minimize overlap
const BADGE_W = 130;
const BADGE_H = 32;
const POSITIONS = ["badge-above", "badge-right", "badge-left", "badge-below"] as const;

function resolveBadgeCollisions(map: L.Map, markers: L.Marker[]) {
  if (map.getZoom() < 17) return;

  interface Rect { x: number; y: number; w: number; h: number; idx: number; pos: number; }

  function getRect(px: L.Point, pos: number): Omit<Rect, "idx"> {
    const w = BADGE_W, h = BADGE_H;
    switch (pos) {
      case 0: return { x: px.x - w / 2, y: px.y - h - 12, w, h, pos }; // above
      case 1: return { x: px.x + 14, y: px.y - h / 2, w, h, pos };     // right
      case 2: return { x: px.x - w - 14, y: px.y - h / 2, w, h, pos }; // left
      case 3: return { x: px.x - w / 2, y: px.y + 14, w, h, pos };     // below
      default: return { x: px.x - w / 2, y: px.y - h - 12, w, h, pos };
    }
  }

  function overlaps(a: Omit<Rect, "idx">, b: Omit<Rect, "idx">): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Get pixel positions for all markers
  const items: { px: L.Point; el: HTMLElement }[] = [];
  for (const m of markers) {
    const el = (m as any)._icon?.querySelector(".marker-badge") as HTMLElement | null;
    if (!el) continue;
    const px = map.latLngToContainerPoint(m.getLatLng());
    items.push({ px, el });
  }

  // Greedily assign positions, preferring above, then right, left, below
  const placed: Omit<Rect, "idx">[] = [];
  for (const item of items) {
    let best = 0;
    for (let p = 0; p < 4; p++) {
      const rect = getRect(item.px, p);
      const hasCollision = placed.some((r) => overlaps(rect, r));
      if (!hasCollision) { best = p; break; }
      if (p === 0) best = p; // fallback to above if all collide
    }
    const finalRect = getRect(item.px, best);
    placed.push(finalRect);

    // Apply position class
    for (const cls of POSITIONS) item.el.classList.remove(cls);
    item.el.classList.add(POSITIONS[best]);
  }
}

/**
 * Sunrise/sunset in local CEST hours for Stockholm (59.33°N, 18.07°E).
 * Uses a standard solar declination approximation — accurate to within ~5 min
 * for our purposes, which is plenty for an ambient lighting effect.
 */
function getSunTimes(date: Date): { sunrise: number; sunset: number } {
  const lat = 59.33;
  const lng = 18.07;
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 0.4093 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const cosH = -Math.tan((lat * Math.PI) / 180) * Math.tan(decl);
  if (cosH >= 1) return { sunrise: 12, sunset: 12 };   // polar night (not expected Apr–Oct)
  if (cosH <= -1) return { sunrise: 0, sunset: 24 };   // midnight sun
  const H = (Math.acos(cosH) * 180) / Math.PI;
  const hours = H / 15;
  const solarNoon = 12 - lng / 15 + 2; // CEST (UTC+2), matches shadow pipeline
  return { sunrise: solarNoon - hours, sunset: solarNoon + hours };
}

/**
 * Calculate ambient darkness (0 = bright daylight, 1 = dark night).
 * Follows the actual sunrise/sunset for the selected date, and adds extra
 * darkening for overcast/rainy weather.
 */
function getAmbientDarkness(hour: number, date: Date, weatherSymbol?: number): number {
  const { sunrise, sunset } = getSunTimes(date);

  // Twilight curve anchored to sunrise/sunset.
  //   Deep night until 1.5h before sunrise, dawn ramp down to full daylight ~1h after,
  //   then full daylight until 1h before sunset, golden-hour ramp up to deep night ~1.5h after.
  let timeDark: number;
  if (hour <= sunrise - 1.5) timeDark = 0.55;
  else if (hour <= sunrise - 0.25) timeDark = 0.55 - ((hour - (sunrise - 1.5)) / 1.25) * 0.35;
  else if (hour <= sunrise + 1) timeDark = 0.20 - ((hour - (sunrise - 0.25)) / 1.25) * 0.20;
  else if (hour <= sunset - 1) timeDark = 0;
  else if (hour <= sunset + 0.25) timeDark = ((hour - (sunset - 1)) / 1.25) * 0.20;
  else if (hour <= sunset + 1.5) timeDark = 0.20 + ((hour - (sunset + 0.25)) / 1.25) * 0.35;
  else timeDark = 0.55;

  // Weather-based adjustment. Clear sky adds a tiny warm overlay (tinted below),
  // while overcast/rain/thunder layers on substantial darkness.
  let weatherDark = 0;
  if (weatherSymbol !== undefined) {
    if (weatherSymbol === 1) weatherDark = 0.03;
    else if (weatherSymbol === 2) weatherDark = 0.02;
    else if (weatherSymbol === 3) weatherDark = 0.05;
    else if (weatherSymbol === 4) weatherDark = 0.11;
    else if (weatherSymbol === 5) weatherDark = 0.18;
    else if (weatherSymbol === 6) weatherDark = 0.26;
    else if (weatherSymbol === 7) weatherDark = 0.20;
    else if (weatherSymbol >= 8 && weatherSymbol <= 10) weatherDark = 0.20 + (weatherSymbol - 8) * 0.05;
    else if (weatherSymbol === 11 || weatherSymbol === 21) weatherDark = 0.34;
    else if (weatherSymbol >= 12 && weatherSymbol <= 17) weatherDark = 0.20;
    else if (weatherSymbol >= 18 && weatherSymbol <= 20) weatherDark = 0.24 + (weatherSymbol - 18) * 0.05;
    else if (weatherSymbol >= 22 && weatherSymbol <= 24) weatherDark = 0.22;
    else if (weatherSymbol >= 25 && weatherSymbol <= 27) weatherDark = 0.26;
  }

  return Math.max(0, Math.min(timeDark + weatherDark, 0.65));
}

/** Get warm/cool tint color based on time of day and weather */
function getAmbientColor(hour: number, date: Date, weatherSymbol?: number): string {
  const { sunrise, sunset } = getSunTimes(date);

  // Rain/thunder — deep cold grey-blue
  if (
    weatherSymbol &&
    (weatherSymbol === 11 ||
      weatherSymbol === 21 ||
      (weatherSymbol >= 8 && weatherSymbol <= 10) ||
      (weatherSymbol >= 18 && weatherSymbol <= 20))
  ) {
    return "35, 42, 58";
  }

  // Overcast / fog — flat grey
  if (weatherSymbol === 5 || weatherSymbol === 6 || weatherSymbol === 7) {
    return "60, 65, 78";
  }

  // Clear / nearly clear during daytime — warm golden overlay so slight alpha reads as sunlit
  if (weatherSymbol !== undefined && weatherSymbol <= 2 && hour > sunrise && hour < sunset) {
    return "255, 210, 140";
  }

  // Golden hour around sunset — warm orange
  if (hour >= sunset - 0.5 && hour <= sunset + 1) return "60, 30, 15";

  // Pre-dawn / late evening — cool blue-purple
  if (hour <= sunrise + 0.5 || hour >= sunset + 1) return "30, 25, 55";

  return "15, 23, 42"; // neutral slate
}

// Cache for loaded shadow GeoJSON
const shadowCache = new Map<string, any>();

export default function SunMap({ hour: hourProp, date, filter, typeFilter, sunRange, weather, onFeedback, showShadows, focusVenueId, onFocusHandled, metroStation }: SunMapProps) {
  // Defer expensive map rebuild while the user is actively scrubbing the timeline
  const hour = useDeferredValue(hourProp);

  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const metroMarkersRef = useRef<L.Marker[]>([]);
  const shadowLayerRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dateKey = useMemo(() => getDateKey(date), [date]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [59.325, 18.07],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    map.on("zoomend", () => {
      const container = map.getContainer();
      container.classList.toggle("show-badges", map.getZoom() >= 17);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Metro station markers — visible at same zoom as venue badges
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    metroMarkersRef.current.forEach((m) => m.remove());
    metroMarkersRef.current = [];

    for (const station of METRO_STATIONS) {
      const lineColor = station.lines.includes("red") ? "#e3000b"
        : station.lines.includes("green") ? "#00a14e"
        : "#0065bd";

      const icon = L.divIcon({
        className: "metro-marker",
        html: `<div class="metro-icon" style="--line-color:${lineColor}">
          <div class="metro-dot" style="background:${lineColor}">T</div>
          <span class="metro-label">${station.name}</span>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([station.lat, station.lng], { icon, interactive: false, zIndexOffset: -100 }).addTo(map);
      metroMarkersRef.current.push(marker);
    }

    return () => {
      metroMarkersRef.current.forEach((m) => m.remove());
      metroMarkersRef.current = [];
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const currentWeather = weather?.hourly[hour];
    const weatherSymbol = currentWeather?.symbolCode;

    allVenues.forEach((venue: any) => {
      const rawStatus = getStatus(venue, dateKey, hour);
      const status = normalize(rawStatus);
      const sunHours = getSunHrs(venue, dateKey);

      // Filter by metro station proximity
      if (metroStation) {
        const dist = distanceM(venue.lat, venue.lng, metroStation.lat, metroStation.lng);
        if (dist > STATION_RADIUS_M) return;
      }

      // Filter by type
      if (typeFilter.size > 0 && !typeFilter.has(venue.type)) return;

      // Filter by sun/shade
      if (filter === "sun" && status !== "sun") return;
      if (filter === "shade" && status !== "shade" && status !== "night") return;

      // Filter by sun range — venue must have sun for every hour in the range
      if (sunRange) {
        let hasSunAllHours = true;
        for (let h = sunRange.from; h <= sunRange.to; h++) {
          const s = normalize(getStatus(venue, dateKey, h));
          if (s !== "sun") { hasSunAllHours = false; break; }
        }
        if (!hasSunAllHours) return;
      }

      // Determine marker style based on combined shadow + weather
      const combined = getCombinedStatus(rawStatus, weatherSymbol);
      const isRain = weatherSymbol && getSymbolInfo(weatherSymbol).category === "rain";
      const isActuallySunny = status === "sun" && weatherSymbol !== undefined && weatherSymbol <= 2;

      let markerClass: string;
      let size: number;
      if (isRain) {
        markerClass = "marker-rain";
        size = 12;
      } else if (isActuallySunny) {
        markerClass = "marker-sun";
        size = 18;
      } else if (status === "sun" && weatherSymbol && weatherSymbol <= 4) {
        markerClass = "marker-partial";
        size = 15;
      } else if (status === "sun") {
        markerClass = "marker-sun";
        size = 18;
      } else {
        markerClass = "marker-shade";
        size = 12;
      }

      const svgIcon = typeToSvgIcon(venue.type);
      const shortName = venue.name.length > 20 ? venue.name.slice(0, 18) + "…" : venue.name;
      const sunPeriod = getSunPeriod(venue, dateKey);
      const badgeHtml = svgIcon ? `
        <div class="marker-badge badge-above">
          <div class="marker-badge-icon">${svgIcon}</div>
          <div class="marker-badge-text">
            <div class="marker-badge-name">${shortName}</div>
            <div class="marker-badge-sun">${sunPeriod}</div>
          </div>
          <div class="marker-badge-arrow"></div>
        </div>` : "";
      const icon = L.divIcon({
        className: markerClass,
        html: badgeHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
      });

      // Store pixel info for collision detection later
      (icon as any)._venueLatLng = [venue.lat, venue.lng];

      // Hourly timeline — dual rows: shadow + weather
      const hours = Array.from({ length: 16 }, (_, i) => i + 7);

      const hourLabels = hours
        .map((h) => {
          const bold = h === hour ? "font-weight:700;color:#0f172a" : "";
          return `<div style="width:14px;text-align:center;font-size:8px;color:#94a3b8;flex-shrink:0;${bold}">${h}</div>`;
        })
        .join("");

      const shadowTimeline = hours
        .map((h) => {
          const s = normalize(getStatus(venue, dateKey, h));
          const bg =
            s === "sun" ? "background:#f59e0b"
            : s === "partial" ? "background:#fb923c"
            : s === "night" ? "background:#1e293b"
            : "background:#cbd5e1";
          const border = h === hour ? "border:2px solid #0f172a" : "";
          return `<div style="width:14px;height:14px;border-radius:3px;${bg};${border};flex-shrink:0" title="${h}:00 — ${statusToLabel(s)}"></div>`;
        })
        .join("");

      const weatherTimeline = weather
        ? hours.map((h) => {
            const hw = weather.hourly[h];
            if (!hw) return `<div style="width:14px;height:14px;border-radius:3px;background:#f1f5f9;flex-shrink:0"></div>`;
            const si = getSymbolInfo(hw.symbolCode);
            const bg =
              si.category === "clear" ? "background:#fbbf24"
              : si.category === "clouds" ? "background:#cbd5e1"
              : si.category === "rain" ? "background:#60a5fa"
              : si.category === "thunder" ? "background:#a78bfa"
              : "background:#c4b5fd";
            const border = h === hour ? "border:2px solid #0f172a" : "";
            return `<div style="width:14px;height:14px;border-radius:3px;${bg};${border};flex-shrink:0" title="${h}:00 — ${si.label} ${Math.round(hw.temperature)}°C"></div>`;
          }).join("")
        : "";

      // Best hour recommendation
      const bestHour = getBestHour(venue, dateKey, weather);
      const bestHourLine = bestHour
        ? `<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:8px;padding:6px 8px;margin-top:6px;display:flex;align-items:center;gap:6px">
            <span style="font-size:14px">&#11088;</span>
            <div>
              <div style="font-size:10px;color:#92400e;font-weight:600">B&auml;sta timmen idag</div>
              <div style="font-size:12px;color:#78350f;font-weight:500">${bestHour.label}</div>
            </div>
          </div>`
        : "";

      // Weather line for current hour
      const weatherLine = currentWeather
        ? `<div style="font-size:11px;color:#64748b;margin-top:6px;display:flex;align-items:center;gap:4px">
            <span>${getSymbolInfo(currentWeather.symbolCode).icon}</span>
            <span>${Math.round(currentWeather.temperature)}°C — ${combined.label}</span>
          </div>`
        : "";

      const address = venue.address || venue.addr_street
        ? `<div style="color:#94a3b8;font-size:11px;margin-top:1px">${venue.address || ""}</div>`
        : "";

      const popup = L.popup({ maxWidth: 300 }).setContent(`
        <div style="min-width:260px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div>
              <strong style="font-size:15px">${venue.name}</strong>
              <div style="color:#64748b;font-size:12px;margin-top:2px">${typeToLabel(venue.type)}</div>
              ${address}
            </div>
            <span style="font-size:24px">${statusToEmoji(status)}</span>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:8px;margin-top:4px">
            <div style="font-size:10px;color:#94a3b8;margin-bottom:2px">SOL / SKUGGA</div>
            <div style="display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto">${shadowTimeline}</div>
            <div style="display:flex;gap:2px;flex-wrap:nowrap;margin-top:1px">${hourLabels}</div>
            ${weatherTimeline ? `
              <div style="font-size:10px;color:#94a3b8;margin-bottom:2px;margin-top:6px">VÄDER</div>
              <div style="display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto">${weatherTimeline}</div>
            ` : ""}
          </div>
          ${weatherLine}
          ${bestHourLine}
          <div style="font-size:12px;color:#64748b;margin-top:6px">${sunHours} soltimmar (vid klart v&auml;der)</div>
          <div id="venue-photo-${venue.id}" style="margin-top:8px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button
              class="fav-btn"
              data-venue-id="${venue.id}"
              style="flex:0 0 36px;padding:4px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#ef4444;font-size:16px;cursor:pointer;text-align:center"
              title="Spara som favorit"
            >${getFavorites().has(venue.id) ? "&#10084;&#65039;" : "&#9825;"}</button>
            <button
              class="share-btn"
              data-venue-id="${venue.id}"
              data-venue-name="${venue.name}"
              style="flex:1;padding:4px 10px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#92400e;font-size:11px;cursor:pointer;text-align:center;font-weight:500"
            >&#128279; Dela</button>
            <button
              class="feedback-btn"
              data-venue-id="${venue.id}"
              style="flex:1;padding:4px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#94a3b8;font-size:11px;cursor:pointer;text-align:center"
            >St&auml;mmer inte?</button>
          </div>
        </div>
      `);

      const marker = L.marker([venue.lat, venue.lng], { icon })
        .addTo(map)
        .bindPopup(popup);

      marker.on("popupopen", () => {
        // Favorite button
        const favBtn = document.querySelector(`.fav-btn[data-venue-id="${venue.id}"]`);
        if (favBtn) {
          (favBtn as HTMLElement).onclick = () => {
            const favs = toggleFavorite(venue.id);
            (favBtn as HTMLElement).innerHTML = favs.has(venue.id) ? "\u2764\uFE0F" : "\u2661";
          };
        }

        // Fetch venue photo
        const photoContainer = document.getElementById(`venue-photo-${venue.id}`);
        if (photoContainer && !photoContainer.dataset.loaded) {
          photoContainer.dataset.loaded = "1";
          const params = new URLSearchParams({
            id: venue.id,
            name: venue.name,
            lat: String(venue.lat),
            lng: String(venue.lng),
          });
          fetch(`/api/venue-photo?${params}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (!data?.photoUrl) return;
              photoContainer.innerHTML = `<img src="${data.photoUrl}" alt="${venue.name}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;display:block" loading="lazy" />`;
            })
            .catch(() => {});
        }

        // Share button
        const shareBtn = document.querySelector(`.share-btn[data-venue-id="${venue.id}"]`);
        if (shareBtn) {
          (shareBtn as HTMLElement).onclick = () => {
            const url = new URL(window.location.href);
            url.search = "";
            url.searchParams.set("venue", venue.id);
            url.searchParams.set("hour", String(hour));
            const shareUrl = url.toString();

            if (navigator.share) {
              navigator.share({ title: `${venue.name} — Soldryck`, text: `Se solläget på ${venue.name}!`, url: shareUrl });
            } else {
              navigator.clipboard.writeText(shareUrl).then(() => {
                (shareBtn as HTMLElement).textContent = "Kopierad!";
                setTimeout(() => { (shareBtn as HTMLElement).innerHTML = "&#128279; Dela"; }, 2000);
              });
            }
          };
        }

        // Feedback button
        const btn = document.querySelector(`.feedback-btn[data-venue-id="${venue.id}"]`);
        if (btn && onFeedback) {
          (btn as HTMLElement).onclick = () => {
            const currentSchedule: Record<number, "sun" | "shade" | "night"> = {};
            for (const h of hours) {
              currentSchedule[h] = normalize(getStatus(venue, dateKey, h)) as "sun" | "shade" | "night";
            }
            onFeedback({
              id: venue.id,
              name: venue.name,
              type: venue.type,
              currentSchedule,
            });
            map.closePopup();
          };
        }
      });

      markersRef.current.push(marker);
    });

    // Collision detection: reassign badge positions to avoid overlap
    resolveBadgeCollisions(map, markersRef.current);
    map.off("zoomend moveend", handleCollisions);
    function handleCollisions() { if (mapRef.current) resolveBadgeCollisions(mapRef.current, markersRef.current); }
    map.on("zoomend moveend", handleCollisions);

    // Pan to metro station when selected
    if (metroStation && !focusVenueId) {
      map.setView([metroStation.lat, metroStation.lng], 15, { animate: true });
    }

    // Focus on venue from URL params
    if (focusVenueId) {
      const targetVenue = allVenues.find((v: any) => v.id === focusVenueId);
      if (targetVenue) {
        map.setView([targetVenue.lat, targetVenue.lng], 16, { animate: true });
        // Find and open the marker's popup
        const targetMarker = markersRef.current.find((m) => {
          const ll = m.getLatLng();
          return Math.abs(ll.lat - targetVenue.lat) < 0.0001 && Math.abs(ll.lng - targetVenue.lng) < 0.0001;
        });
        if (targetMarker) {
          setTimeout(() => targetMarker.openPopup(), 500);
        }
      }
      onFocusHandled?.();
    }
  }, [hour, dateKey, filter, typeFilter, sunRange, weather, metroStation]);

  // Shadow overlay layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous shadow layer
    if (shadowLayerRef.current) {
      shadowLayerRef.current.remove();
      shadowLayerRef.current = null;
    }

    if (!showShadows) return;

    const key = `${dateKey}_${String(hour).padStart(2, "0")}`;
    const url = `/api/shadows?key=${key}`;

    const cached = shadowCache.get(key);
    if (cached) {
      shadowLayerRef.current = L.geoJSON(cached, {
        style: { color: "transparent", fillColor: "#1e293b", fillOpacity: 0.18, stroke: false },
        interactive: false,
      }).addTo(map);
      return;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data || !mapRef.current) return;
        shadowCache.set(key, data);
        // Only add if still the current timepoint
        if (shadowLayerRef.current) shadowLayerRef.current.remove();
        shadowLayerRef.current = L.geoJSON(data, {
          style: { color: "transparent", fillColor: "#1e293b", fillOpacity: 0.18, stroke: false },
          interactive: false,
        }).addTo(mapRef.current);
      })
      .catch(() => {});
  }, [hour, dateKey, showShadows]);

  const currentWeatherSymbol = weather?.hourly[hour]?.symbolCode;
  const darkness = getAmbientDarkness(hour, date, currentWeatherSymbol);
  const ambientColor = getAmbientColor(hour, date, currentWeatherSymbol);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      <div
        className="absolute inset-0 pointer-events-none z-[400]"
        style={{
          background: `rgba(${ambientColor}, ${darkness})`,
          transition: "background 0.8s ease",
        }}
      />
    </div>
  );
}
