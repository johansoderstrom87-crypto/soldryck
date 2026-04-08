"use client";

import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import {
  mockVenues,
  getClosestDateKey,
  getVenueStatus,
  getSunHours,
  type SunStatus,
} from "../data/mock-venues";

interface SunMapProps {
  hour: number;
  date: Date;
  filter: "all" | "sun" | "shade";
}

function statusToLabel(status: SunStatus): string {
  switch (status) {
    case "sun":
      return "Sol";
    case "partial":
      return "Delvis sol";
    case "shade":
      return "Skugga";
  }
}

function statusToEmoji(status: SunStatus): string {
  switch (status) {
    case "sun":
      return "\u2600\uFE0F";
    case "partial":
      return "\u26C5";
    case "shade":
      return "\uD83C\uDF25\uFE0F";
  }
}

function typeToLabel(type: string): string {
  switch (type) {
    case "restaurant":
      return "Restaurang";
    case "cafe":
      return "Cafe";
    case "bar":
      return "Bar";
    default:
      return type;
  }
}

export default function SunMap({ hour, date, filter }: SunMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const dateKey = useMemo(() => getClosestDateKey(date), [date]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [59.325, 18.08],
      zoom: 14,
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

  // Update markers when hour/date/filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    mockVenues.forEach((venue) => {
      const status = getVenueStatus(venue, dateKey, hour);
      const sunHours = getSunHours(venue, dateKey);

      // Apply filter
      if (filter === "sun" && status !== "sun") return;
      if (filter === "shade" && status !== "shade") return;

      const size = status === "sun" ? 20 : status === "partial" ? 16 : 14;

      const icon = L.divIcon({
        className: `marker-${status}`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
      });

      // Build hourly timeline for popup
      const hours = Array.from({ length: 15 }, (_, i) => i + 8);
      const timeline = hours
        .map((h) => {
          const s = getVenueStatus(venue, dateKey, h);
          const bg =
            s === "sun"
              ? "background:#f59e0b"
              : s === "partial"
              ? "background:#fb923c"
              : "background:#cbd5e1";
          const border = h === hour ? "border:2px solid #0f172a" : "";
          return `<div style="width:16px;height:16px;border-radius:3px;${bg};${border}" title="${h}:00 - ${statusToLabel(s)}"></div>`;
        })
        .join("");

      const popup = L.popup({ maxWidth: 280 }).setContent(`
        <div style="min-width:240px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div>
              <strong style="font-size:15px">${venue.name}</strong>
              <div style="color:#64748b;font-size:12px;margin-top:2px">${typeToLabel(venue.type)}</div>
            </div>
            <span style="font-size:24px">${statusToEmoji(status)}</span>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:8px;margin-top:4px">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">Kl ${hour}:00 — <strong style="color:${status === "sun" ? "#d97706" : status === "partial" ? "#ea580c" : "#475569"}">${statusToLabel(status)}</strong></div>
            <div style="display:flex;gap:2px">${timeline}</div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-top:2px">
              <span>08</span><span>15</span><span>22</span>
            </div>
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:8px">${sunHours} soltimmar idag</div>
        </div>
      `);

      const marker = L.marker([venue.lat, venue.lng], { icon }).addTo(map).bindPopup(popup);
      markersRef.current.push(marker);
    });
  }, [hour, dateKey, filter]);

  return <div ref={containerRef} className="w-full h-full" />;
}
