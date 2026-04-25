"use client";

import { useState, useRef, useEffect } from "react";
import { type VenueType, type SunRange } from "./SunMap";
import { METRO_STATIONS, type MetroStation } from "../data/metro-stations";
import FavoritesPanel from "./FavoritesPanel";

const TYPE_OPTIONS: { value: VenueType; label: string; icon: string }[] = [
  { value: "restaurant", label: "Restaurang", icon: "🍽️" },
  { value: "cafe", label: "Café", icon: "☕" },
  { value: "bar", label: "Bar & Pub", icon: "🍸" },
  { value: "rooftop", label: "Takbar", icon: "🏙️" },
];

interface HeaderProps {
  filter: "all" | "sun" | "shade";
  onFilterChange: (filter: "all" | "sun" | "shade") => void;
  typeFilter: Set<VenueType>;
  onTypeFilterChange: (types: Set<VenueType>) => void;
  sunRange: SunRange;
  onSunRangeChange: (range: SunRange) => void;
  showShadows: boolean;
  onToggleShadows: () => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
  venues: { id: string; name: string; type: string; address: string; lat: number; lng: number }[];
  onSelectVenue: (id: string) => void;
}

const FILTER_OPTIONS: { value: "all" | "sun" | "shade"; label: string; icon: string; activeClass: string }[] = [
  { value: "all", label: "Alla", icon: "◉", activeClass: "bg-slate-900 text-white" },
  { value: "sun", label: "Sol", icon: "☀️", activeClass: "bg-amber-500 text-white" },
  { value: "shade", label: "Skugga", icon: "☁️", activeClass: "bg-slate-500 text-white" },
];

function SettingsButton({
  filter, onFilterChange, typeFilter, onTypeFilterChange, sunRange, onSunRangeChange,
  metroStation, onMetroStationChange, showShadows, onToggleShadows,
}: {
  filter: "all" | "sun" | "shade";
  onFilterChange: (f: "all" | "sun" | "shade") => void;
  typeFilter: Set<VenueType>;
  onTypeFilterChange: (types: Set<VenueType>) => void;
  sunRange: SunRange;
  onSunRangeChange: (range: SunRange) => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
  showShadows: boolean;
  onToggleShadows: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") { setInstallPrompt(null); setOpen(false); }
  };

  function toggleType(type: VenueType) {
    const next = new Set(typeFilter);
    if (next.has(type)) next.delete(type); else next.add(type);
    onTypeFilterChange(next);
  }

  const activeCount =
    (filter !== "all" ? 1 : 0) +
    typeFilter.size +
    (sunRange ? 1 : 0) +
    (metroStation ? 1 : 0) +
    (showShadows ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-xl shadow-lg backdrop-blur-md px-2.5 py-1.5 flex items-center gap-1.5 transition-all bg-white/95 text-slate-600 hover:bg-white"
        title="Inställningar"
      >
        {/* Hamburger icon */}
        <svg width="17" height="14" viewBox="0 0 17 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="1" y1="2" x2="16" y2="2" />
          <line x1="1" y1="7" x2="16" y2="7" />
          <line x1="1" y1="12" x2="16" y2="12" />
        </svg>
        {activeCount > 0 && (
          <span className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white/95 backdrop-blur-md rounded-xl shadow-lg p-1 min-w-[200px] z-[2000]">

          {/* Install app — only shown when browser supports it */}
          {installPrompt && (
            <>
              <button
                onClick={handleInstall}
                className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left flex items-center gap-2 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors border border-amber-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Installera appen
              </button>
              <div className="border-t border-slate-200 my-1" />
            </>
          )}

          {/* Sun/shade filter */}
          <div className="flex flex-col gap-0.5">
            {FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => onFilterChange(o.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center gap-1.5 transition-all ${
                  filter === o.value ? o.activeClass : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span className="text-[10px]">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 my-1" />

          {/* Shadows toggle */}
          <button
            onClick={() => { onToggleShadows(); }}
            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all ${
              showShadows ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="4" />
                <path d="M8 4v0a4 4 0 0 1 0 8v0" fill="currentColor" stroke="none" />
              </svg>
              Skuggor
            </span>
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${showShadows ? "bg-white/30" : "bg-slate-200"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${showShadows ? "translate-x-3" : "translate-x-0"}`} />
            </span>
          </button>

          <div className="border-t border-slate-200 my-1" />

          {/* Type filter checkboxes */}
          <div className="px-1.5 py-0.5">
            <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Typ av ställe</div>
            {TYPE_OPTIONS.map((t) => (
              <label
                key={t.value}
                className="flex items-center gap-2 px-1.5 py-1 rounded-lg text-xs cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={typeFilter.size === 0 || typeFilter.has(t.value)}
                  onChange={() => toggleType(t.value)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span>{t.icon}</span>
                <span className="text-slate-600">{t.label}</span>
              </label>
            ))}
          </div>

          <div className="border-t border-slate-200 my-1" />

          {/* Sun time range filter */}
          <div className="px-1.5 py-0.5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Sol mellan</div>
              {sunRange && (
                <button onClick={() => onSunRangeChange(null)} className="text-[9px] text-amber-500 hover:text-amber-600 font-medium">
                  Rensa
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={sunRange?.from ?? ""}
                onChange={(e) => {
                  const from = Number(e.target.value);
                  if (!from && from !== 0) { onSunRangeChange(null); return; }
                  onSunRangeChange({ from, to: sunRange?.to ?? Math.min(from + 4, 22) });
                }}
                className="flex-1 px-1.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 cursor-pointer"
              >
                <option value="">Från</option>
                {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
              <span className="text-slate-400 text-xs">–</span>
              <select
                value={sunRange?.to ?? ""}
                onChange={(e) => {
                  const to = Number(e.target.value);
                  if (!to) { onSunRangeChange(null); return; }
                  onSunRangeChange({ from: sunRange?.from ?? 8, to });
                }}
                className="flex-1 px-1.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 cursor-pointer"
              >
                <option value="">Till</option>
                {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            {sunRange && (
              <div className="text-[9px] text-amber-600 mt-1">
                Visar ställen med sol {String(sunRange.from).padStart(2, "0")}–{String(sunRange.to).padStart(2, "0")}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 my-1" />

          {/* Metro station filter */}
          <div className="px-1.5 py-0.5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Nära T-bana</div>
              {metroStation && (
                <button onClick={() => onMetroStationChange(null)} className="text-[9px] text-amber-500 hover:text-amber-600 font-medium">
                  Rensa
                </button>
              )}
            </div>
            <select
              value={metroStation?.name ?? ""}
              onChange={(e) => {
                if (!e.target.value) { onMetroStationChange(null); return; }
                const station = METRO_STATIONS.find((s) => s.name === e.target.value) ?? null;
                onMetroStationChange(station);
              }}
              className="w-full px-1.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 cursor-pointer"
            >
              <option value="">Alla stationer</option>
              {METRO_STATIONS
                .sort((a, b) => a.name.localeCompare(b.name, "sv"))
                .map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
            </select>
            {metroStation && (
              <div className="text-[9px] text-amber-600 mt-1">
                Visar inom 500m från {metroStation.name}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  filter, onFilterChange, typeFilter, onTypeFilterChange, sunRange, onSunRangeChange,
  showShadows, onToggleShadows, metroStation, onMetroStationChange, venues, onSelectVenue,
}: HeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-[1100] pointer-events-none">
      <div className="p-3">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <SettingsButton
            filter={filter}
            onFilterChange={onFilterChange}
            typeFilter={typeFilter}
            onTypeFilterChange={onTypeFilterChange}
            sunRange={sunRange}
            onSunRangeChange={onSunRangeChange}
            metroStation={metroStation}
            onMetroStationChange={onMetroStationChange}
            showShadows={showShadows}
            onToggleShadows={onToggleShadows}
          />
          <FavoritesPanel venues={venues} onSelectVenue={onSelectVenue} />
        </div>
      </div>
    </div>
  );
}
