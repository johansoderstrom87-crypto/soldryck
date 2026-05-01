"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { type VenueType, type SunRange } from "./SunMap";
import { METRO_STATIONS, type MetroStation } from "../data/metro-stations";
import FavoritesPanel from "./FavoritesPanel";

const LINE_COLORS: Record<string, string> = {
  red: "#e3000b",
  green: "#00a14e",
  blue: "#0065bd",
};

function LineDots({ lines }: { lines: string[] }) {
  return (
    <span className="flex gap-0.5 flex-shrink-0 items-center">
      {lines.map((l) => (
        <span key={l} className="w-2 h-2 rounded-full" style={{ background: LINE_COLORS[l] ?? "#94a3b8" }} />
      ))}
    </span>
  );
}

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
  showMetro: boolean;
  onToggleMetro: () => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
  venues: { id: string; name: string; type: string; address: string; lat: number; lng: number }[];
  onSelectVenue: (id: string) => void;
  hour: number;
  dateKey: string;
  getStatus: (venue: any, dateKey: string, hour: number) => string | undefined;
}

const FILTER_OPTIONS: { value: "all" | "sun" | "shade"; label: string; icon: string; activeClass: string }[] = [
  { value: "all", label: "Alla", icon: "◉", activeClass: "bg-slate-900 text-white" },
  { value: "sun", label: "Sol", icon: "☀️", activeClass: "bg-amber-500 text-white" },
  { value: "shade", label: "Skugga", icon: "☁️", activeClass: "bg-slate-500 text-white" },
];

function SettingsButton({
  filter, onFilterChange, typeFilter, onTypeFilterChange, sunRange, onSunRangeChange,
  metroStation, onMetroStationChange, showShadows, onToggleShadows, showMetro, onToggleMetro,
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
  showMetro: boolean;
  onToggleMetro: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [metroOpen, setMetroOpen] = useState(false);
  const [metroSearch, setMetroSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const sortedStations = useMemo(
    () => [...METRO_STATIONS].sort((a, b) => a.name.localeCompare(b.name, "sv")),
    [],
  );
  const filteredStations = useMemo(() => {
    const q = metroSearch.trim().toLowerCase();
    if (!q) return sortedStations;
    return sortedStations.filter((s) => s.name.toLowerCase().includes(q));
  }, [metroSearch, sortedStations]);

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
    (metroStation ? 1 : 0) +
    (showShadows ? 1 : 0) +
    (showMetro ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 transition-all text-slate-700"
        style={{
          background: "rgba(255,255,255,0.3)",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          border: "0.5px solid rgba(255,255,255,0.55)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        }}
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
        <div className="absolute top-full left-0 mt-1 rounded-xl p-1 min-w-[200px] z-[2000]" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", border: "0.5px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>

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

          {/* Tunnelbana toggle */}
          <button
            onClick={() => { onToggleMetro(); }}
            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all ${
              showMetro ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {/* Three small dots in SL line colors — recognisable as the metro */}
              <span className="flex items-center gap-[2px]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#e3000b" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00a14e" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#0065bd" }} />
              </span>
              Tunnelbana
            </span>
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${showMetro ? "bg-white/30" : "bg-slate-200"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${showMetro ? "translate-x-3" : "translate-x-0"}`} />
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

          {/* Metro station filter — searchable picker */}
          <div className="px-1.5 py-0.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Nära T-bana</div>
              {metroStation && (
                <button onClick={() => onMetroStationChange(null)} className="text-[9px] text-amber-500 hover:text-amber-600 font-medium">
                  Rensa
                </button>
              )}
            </div>

            <button
              onClick={() => setMetroOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
              style={{
                background: "rgba(255,255,255,0.5)",
                border: "0.5px solid rgba(255,255,255,0.7)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {metroStation ? (
                <>
                  <LineDots lines={metroStation.lines} />
                  <span className="text-xs font-medium text-slate-700 flex-1 truncate">{metroStation.name}</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="text-xs text-slate-500 flex-1">Alla stationer</span>
                </>
              )}
              <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform text-slate-400 flex-shrink-0 ${metroOpen ? "rotate-180" : ""}`}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>

            {metroOpen && (
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(255,255,255,0.7)" }}>
                {/* Search */}
                <div className="relative p-1.5 pb-1">
                  <svg width="11" height="11" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={metroSearch}
                    onChange={(e) => setMetroSearch(e.target.value)}
                    placeholder="Sök station..."
                    autoFocus
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white/80 text-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* List */}
                <div className="overflow-y-auto px-1 pb-1" style={{ maxHeight: 200 }}>
                  {!metroSearch && (
                    <button
                      onClick={() => { onMetroStationChange(null); setMetroOpen(false); setMetroSearch(""); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition ${!metroStation ? "bg-amber-100/80 text-amber-800 font-semibold" : "text-slate-500 hover:bg-white/60"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                      <span className="flex-1">Alla stationer</span>
                      {!metroStation && <span className="text-amber-500 text-sm leading-none">✓</span>}
                    </button>
                  )}

                  {filteredStations.map((s) => {
                    const isSelected = metroStation?.name === s.name;
                    return (
                      <button
                        key={s.name}
                        onClick={() => { onMetroStationChange(s); setMetroOpen(false); setMetroSearch(""); }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition ${isSelected ? "bg-amber-100/80 text-amber-800 font-semibold" : "text-slate-600 hover:bg-white/60"}`}
                      >
                        <LineDots lines={s.lines} />
                        <span className="flex-1 truncate">{s.name}</span>
                        {isSelected && <span className="text-amber-500 text-sm leading-none">✓</span>}
                      </button>
                    );
                  })}

                  {filteredStations.length === 0 && (
                    <div className="px-2 py-3 text-center text-[10px] text-slate-400">
                      Inga stationer hittades
                    </div>
                  )}
                </div>
              </div>
            )}

            {metroStation && !metroOpen && (
              <div className="text-[9px] text-amber-600 mt-1.5 px-1">
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
  showShadows, onToggleShadows, showMetro, onToggleMetro,
  metroStation, onMetroStationChange, venues, onSelectVenue, hour, dateKey, getStatus,
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
            showMetro={showMetro}
            onToggleMetro={onToggleMetro}
          />
          <div className="flex-1 flex justify-center pointer-events-none select-none">
            <Image src="/logo.png" alt="Soldryck" width={36} height={42} style={{ objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(245,158,11,0.3))" }} />
          </div>
          <FavoritesPanel venues={venues} onSelectVenue={onSelectVenue} hour={hour} dateKey={dateKey} getStatus={getStatus} />
        </div>
      </div>
    </div>
  );
}
