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

const TYPE_BUTTONS: { type: VenueType; label: string; svg: string }[] = [
  {
    type: "restaurant",
    label: "Mat",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
  },
  {
    type: "cafe",
    label: "Café",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  },
  {
    type: "bar",
    label: "Bar & Pub",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
  },
  {
    type: "rooftop",
    label: "Takbar",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><line x1="3" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="21" y2="7"/></svg>`,
  },
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
  embedded,
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
  embedded?: boolean;
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
        className={embedded
          ? "rounded-xl flex items-center justify-center transition-all text-slate-700 relative hover:bg-white/40"
          : "rounded-xl flex items-center justify-center transition-all text-slate-700 relative"}
        style={embedded ? {
          width: 32,
          height: 32,
        } : {
          width: 40,
          height: 40,
          background: "rgba(255,255,255,0.3)",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          border: "0.5px solid rgba(255,255,255,0.55)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          transform: "translateZ(0)",
          isolation: "isolate",
        }}
        title="Inställningar"
      >
        {/* Hamburger icon */}
        <svg width="18" height="15" viewBox="0 0 17 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="1" y1="2" x2="16" y2="2" />
          <line x1="1" y1="7" x2="16" y2="7" />
          <line x1="1" y1="12" x2="16" y2="12" />
        </svg>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl p-1 min-w-[220px] z-[2000]" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", border: "0.5px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", transform: "translateZ(0)", isolation: "isolate" }}>

          {/* Logo header */}
          <div className="flex items-center gap-2 px-2 pt-2 pb-2.5">
            <Image
              src="/logo.png"
              alt="Soldryck"
              width={32}
              height={38}
              style={{ objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.25))" }}
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-slate-800 tracking-tight" style={{ fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif" }}>
                Soldryck
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
                Stockholm
              </span>
            </div>
          </div>
          <div className="border-t border-slate-200/70 mb-1" />

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

          {/* Install app — pinned to bottom, only shown when browser supports it */}
          {installPrompt && (
            <>
              <div className="border-t border-slate-200 my-1" />
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
            </>
          )}
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
  const [filtersOpen, setFiltersOpen] = useState(true);

  function toggleType(type: VenueType) {
    const next = new Set(typeFilter);
    if (next.has(type)) next.delete(type); else next.add(type);
    onTypeFilterChange(next);
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-[1100] pointer-events-none">
      {/* Centered top stack — wide card + filter row */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto select-none" style={{ top: 0 }}>

        {/* Top card: settings on left, logo centered, favorites on right */}
        <div
          className="flex items-center justify-center gap-2.5 px-3 pt-1 pb-1"
          style={{
            position: "relative",
            zIndex: 20,
            borderRadius: "0 0 18px 18px",
            background: "rgba(255,255,255,0.3)",
            backdropFilter: "blur(14px) saturate(1.3)",
            WebkitBackdropFilter: "blur(14px) saturate(1.3)",
            border: "0.5px solid rgba(255,255,255,0.55)",
            borderTop: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            transform: "translateZ(0)",
            isolation: "isolate",
          }}
        >
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
            embedded
          />

          {/* Centered logo */}
          <Image
            src="/logo.png"
            alt="Soldryck"
            width={54}
            height={66}
            style={{ objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(245,158,11,0.3))" }}
          />

          <FavoritesPanel venues={venues} onSelectVenue={onSelectVenue} hour={hour} dateKey={dateKey} getStatus={getStatus} embedded />
        </div>

        {/* Filter row + collapse toggle */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* marginBottom collapse — no overflow:hidden so backdrop-filter has no ghost box and buttons aren't clipped */}
          <div
            style={{
              display: "flex",
              gap: 6,
              fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
              opacity: filtersOpen ? 1 : 0,
              visibility: filtersOpen ? "visible" : "hidden",
              transform: filtersOpen ? "translateY(0)" : "translateY(-4px)",
              marginBottom: filtersOpen ? 0 : -50,
              pointerEvents: filtersOpen ? "auto" : "none",
              transition:
                "margin-bottom 0.26s ease, opacity 0.22s ease, transform 0.24s ease, " +
                "visibility 0s linear " + (filtersOpen ? "0s" : "0.24s"),
            }}
          >
            {TYPE_BUTTONS.map(({ type, label, svg }) => {
                const active = typeFilter.size === 0 || typeFilter.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    title={label}
                    className="rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
                    style={{
                      width: 46,
                      height: 46,
                      background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.14)",
                      backgroundImage: active
                        ? "radial-gradient(circle at 50% 40%, rgba(251,146,60,0.14) 0%, transparent 70%)"
                        : undefined,
                      backdropFilter: "blur(16px) saturate(1.5)",
                      WebkitBackdropFilter: "blur(16px) saturate(1.5)",
                      border: active
                        ? "1px solid rgba(251,146,60,0.75)"
                        : "0.5px solid rgba(255,255,255,0.45)",
                      boxShadow: active
                        ? "0 0 0 1px rgba(251,146,60,0.35), 0 0 14px rgba(251,146,60,0.6), 0 0 28px rgba(251,146,60,0.3), inset 0 1px 1px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.08)"
                        : "0 2px 8px rgba(0,0,0,0.06)",
                      color: active ? "#0f172a" : "#888",
                      opacity: active ? 1 : 0.65,
                      transform: "translateZ(0)",
                      isolation: "isolate",
                      flexShrink: 0,
                    }}
                  >
                    <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, color: active ? "#0f172a" : "rgba(0,0,0,0.55)" }}>
                      {label === "Bar & Pub" ? "Bar" : label}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Collapse / expand toggle — chevron ∧ when open (pointing up = hide), ∨ when closed (pointing down = show) */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            title={filtersOpen ? "Dölj filter" : "Visa filter"}
            style={{
              background: "rgba(255,255,255,0.28)",
              backdropFilter: "blur(14px) saturate(1.3)",
              WebkitBackdropFilter: "blur(14px) saturate(1.3)",
              border: "0.5px solid rgba(255,255,255,0.55)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              borderRadius: 999,
              width: 28,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transform: "translateZ(0)",
              isolation: "isolate",
            }}
          >
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
              }}
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
