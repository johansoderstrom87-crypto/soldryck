"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";

// Load computed data if available, otherwise mock
let venueModule: any;
try {
  venueModule = require("../data/venues-computed");
} catch {
  venueModule = require("../data/mock-venues");
}

import { type WeatherData, getSymbolInfo, getCombinedStatus } from "../lib/weather";

export interface FeedbackVenue {
  id: string;
  name: string;
  type: string;
  currentSchedule: Record<number, "sun" | "shade" | "night">;
}

export const VENUE_TYPES = ["restaurant", "cafe", "bar", "pub"] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

interface SunMapProps {
  hour: number;
  date: Date;
  filter: "all" | "sun" | "shade";
  typeFilter: Set<VenueType>;
  weather: WeatherData | null;
  onFeedback?: (venue: FeedbackVenue) => void;
  showShadows?: boolean;
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

function typeToEmoji(type: string): string {
  return { restaurant: "🍽️", cafe: "☕", bar: "🍺", pub: "🍺" }[type] ?? "";
}

const getDateKey = venueModule.getClosestDateKey;
const getStatus = venueModule.getVenueStatus ?? venueModule.getVenueStatus;
const getSunHrs = venueModule.getSunHours;
const allVenues = venueModule.venues ?? venueModule.mockVenues;

// Cache for loaded shadow GeoJSON
const shadowCache = new Map<string, any>();

export default function SunMap({ hour, date, filter, typeFilter, weather, onFeedback, showShadows }: SunMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
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

      // Filter by type
      if (typeFilter.size > 0 && !typeFilter.has(venue.type)) return;

      // Filter by sun/shade
      if (filter === "sun" && status !== "sun") return;
      if (filter === "shade" && status !== "shade" && status !== "night") return;

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

      const emoji = typeToEmoji(venue.type);
      const shortName = venue.name.length > 18 ? venue.name.slice(0, 16) + "…" : venue.name;
      const icon = L.divIcon({
        className: markerClass,
        html: emoji ? `<span class="marker-badge">${emoji} ${shortName}</span>` : "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
      });

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
          <div style="font-size:12px;color:#64748b;margin-top:6px">${sunHours} soltimmar (vid klart v&auml;der)</div>
          <button
            class="feedback-btn"
            data-venue-id="${venue.id}"
            style="margin-top:8px;padding:4px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#94a3b8;font-size:11px;cursor:pointer;width:100%;text-align:center"
          >St&auml;mmer inte?</button>
        </div>
      `);

      const marker = L.marker([venue.lat, venue.lng], { icon })
        .addTo(map)
        .bindPopup(popup);

      marker.on("popupopen", () => {
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
  }, [hour, dateKey, filter, typeFilter, weather]);

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

  return <div ref={containerRef} className="w-full h-full" />;
}
