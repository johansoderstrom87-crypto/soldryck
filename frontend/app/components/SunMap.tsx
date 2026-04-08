"use client";

import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";

// Load computed data if available, otherwise mock
let venueModule: any;
try {
  venueModule = require("../data/venues-computed");
} catch {
  venueModule = require("../data/mock-venues");
}

interface SunMapProps {
  hour: number;
  date: Date;
  filter: "all" | "sun" | "shade";
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

const getDateKey = venueModule.getClosestDateKey;
const getStatus = venueModule.getVenueStatus ?? venueModule.getVenueStatus;
const getSunHrs = venueModule.getSunHours;
const allVenues = venueModule.venues ?? venueModule.mockVenues;

export default function SunMap({ hour, date, filter }: SunMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
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

    allVenues.forEach((venue: any) => {
      const rawStatus = getStatus(venue, dateKey, hour);
      const status = normalize(rawStatus);
      const sunHours = getSunHrs(venue, dateKey);

      // Filter
      if (filter === "sun" && status !== "sun") return;
      if (filter === "shade" && status !== "shade" && status !== "night") return;

      const size = status === "sun" ? 18 : status === "partial" ? 15 : 12;

      const icon = L.divIcon({
        className: `marker-${status === "night" ? "shade" : status}`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
      });

      // Hourly timeline
      const hours = Array.from({ length: 16 }, (_, i) => i + 7);
      const timeline = hours
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

      const statusColor =
        status === "sun" ? "#d97706"
        : status === "partial" ? "#ea580c"
        : "#475569";

      const address = venue.address || venue.addr_street
        ? `<div style="color:#94a3b8;font-size:11px;margin-top:1px">${venue.address || ""}</div>`
        : "";

      const popup = L.popup({ maxWidth: 300 }).setContent(`
        <div style="min-width:250px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div>
              <strong style="font-size:15px">${venue.name}</strong>
              <div style="color:#64748b;font-size:12px;margin-top:2px">${typeToLabel(venue.type)}</div>
              ${address}
            </div>
            <span style="font-size:24px">${statusToEmoji(status)}</span>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:8px;margin-top:4px">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">Kl ${hour}:00 — <strong style="color:${statusColor}">${statusToLabel(status)}</strong></div>
            <div style="display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto">${timeline}</div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-top:2px">
              <span>07</span><span>14</span><span>22</span>
            </div>
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:8px">${sunHours} soltimmar denna dag</div>
        </div>
      `);

      const marker = L.marker([venue.lat, venue.lng], { icon })
        .addTo(map)
        .bindPopup(popup);
      markersRef.current.push(marker);
    });
  }, [hour, dateKey, filter]);

  return <div ref={containerRef} className="w-full h-full" />;
}
