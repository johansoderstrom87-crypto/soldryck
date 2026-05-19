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

const TYPE_BUTTONS: { type: VenueType; label: string; svg: string }[] = [
  {
    type: "restaurant",
    label: "Äta",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
  },
  {
    type: "cafe",
    label: "Fika",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  },
  {
    type: "bar",
    label: "Glas",
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
  showRain: boolean;
  onToggleRain: () => void;
  wheelchairOnly: boolean;
  onWheelchairOnlyChange: (v: boolean) => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
  openNowFilter: boolean;
  onOpenNowFilterChange: (v: boolean) => void;
  venues: { id: string; name: string; type: string; address: string; lat: number; lng: number }[];
  onSelectVenue: (id: string) => void;
  hour: number;
  dateKey: string;
  getStatus: (venue: any, dateKey: string, hour: number) => string | undefined;
  getClosestDateKey: (date: Date) => string;
}

const FILTER_OPTIONS: { value: "all" | "sun" | "shade"; label: string; icon: string; activeClass: string }[] = [
  { value: "all", label: "Alla", icon: "◉", activeClass: "bg-slate-900 text-white" },
  { value: "sun", label: "Sol", icon: "☀️", activeClass: "bg-amber-500 text-white" },
  { value: "shade", label: "Skugga", icon: "☁️", activeClass: "bg-slate-500 text-white" },
];

function SettingsButton({
  filter, onFilterChange, typeFilter, onTypeFilterChange, sunRange, onSunRangeChange,
  metroStation, onMetroStationChange, showShadows, onToggleShadows, showMetro, onToggleMetro,
  showRain, onToggleRain,
  wheelchairOnly, onWheelchairOnlyChange,
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
  showRain: boolean;
  onToggleRain: () => void;
  wheelchairOnly: boolean;
  onWheelchairOnlyChange: (v: boolean) => void;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [metroOpen, setMetroOpen] = useState(false);
  const [metroSearch, setMetroSearch] = useState("");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionState, setSuggestionState] = useState<"idle" | "sending" | "sent" | "error">("idle");
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

  // Escape closes the suggestion modal (unless we're mid-send).
  useEffect(() => {
    if (!suggestionOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && suggestionState !== "sending") setSuggestionOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [suggestionOpen, suggestionState]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") { setInstallPrompt(null); setOpen(false); }
  };

  async function submitSuggestion() {
    const message = suggestionText.trim();
    if (!message || suggestionState === "sending") return;
    setSuggestionState("sending");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed");
      setSuggestionState("sent");
      setSuggestionText("");
      setTimeout(() => { setSuggestionOpen(false); setSuggestionState("idle"); }, 1200);
    } catch {
      setSuggestionState("error");
    }
  }

  const activeCount =
    (filter !== "all" ? 1 : 0) +
    typeFilter.size +
    (metroStation ? 1 : 0) +
    (showShadows ? 1 : 0) +
    (showMetro ? 1 : 0) +
    (showRain ? 1 : 0) +
    (wheelchairOnly ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Stäng inställningar" : `Inställningar och filter${activeCount > 0 ? ` (${activeCount} aktiva)` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
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
                aria-pressed={filter === o.value}
                aria-label={`Visa ${o.label.toLowerCase()}`}
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
            aria-pressed={showShadows}
            aria-label={showShadows ? "Dölj skuggor på kartan" : "Visa skuggor på kartan"}
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

          {/* Regnradar toggle */}
          <button
            onClick={() => { onToggleRain(); }}
            aria-pressed={showRain}
            aria-label={showRain ? "Dölj regnradar" : "Visa regnradar"}
            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all ${
              showRain ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                <line x1="8" y1="19" x2="8" y2="21" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="16" y1="19" x2="16" y2="21" />
              </svg>
              Regnradar
            </span>
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${showRain ? "bg-white/30" : "bg-slate-200"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${showRain ? "translate-x-3" : "translate-x-0"}`} />
            </span>
          </button>

          {/* Wheelchair-only toggle.
              Filters to venues tagged wheelchair=yes in OSM. Data fills in
              after the pipeline regenerates with #42 — until then the
              filter just hides everything, which is the correct behaviour
              for accessibility tools (false positives are worse than no
              results). */}
          <button
            onClick={() => onWheelchairOnlyChange(!wheelchairOnly)}
            aria-pressed={wheelchairOnly}
            aria-label={wheelchairOnly ? "Visa alla ställen" : "Visa bara tillgängliga ställen"}
            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all ${
              wheelchairOnly ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="4" r="2" />
                <path d="M12 7v8l4 3" />
                <path d="M10 11l-3 1" />
                <circle cx="14" cy="18" r="4" />
              </svg>
              Tillgängligt
            </span>
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${wheelchairOnly ? "bg-white/30" : "bg-slate-200"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${wheelchairOnly ? "translate-x-3" : "translate-x-0"}`} />
            </span>
          </button>

          {/* Tunnelbana toggle */}
          <button
            onClick={() => { onToggleMetro(); }}
            aria-pressed={showMetro}
            aria-label={showMetro ? "Dölj tunnelbanenät" : "Visa tunnelbanenät"}
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

          {/* Note: type-filter chips and Tillstånd live in the filter row
              (the visible row of pills below the logo card), not here — see
              [Header.tsx filter row]. Duplicating them in this dropdown was
              confusing because state from the row and the dropdown could
              read different but render the same toggle. Settings now only
              hosts toggles that don't have a dedicated chip. */}

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

          <div className="border-t border-slate-200 my-1" />

          {/* Suggestion button — opens modal */}
          <button
            onClick={() => { setOpen(false); setSuggestionOpen(true); setSuggestionState("idle"); }}
            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center gap-1.5 text-slate-600 hover:bg-slate-100 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Kom med förslag
          </button>

          {/* För-ägare-länk — surfaces the /for-restaurants landing for
              owners who arrive via word of mouth instead of clicking
              "Äger du det här?" in a popup. */}
          <a
            href="/for-restaurants"
            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center gap-1.5 text-slate-600 hover:bg-slate-100 transition-all no-underline"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            För ägare
          </a>

          {/* Privacy link */}
          <a
            href="/privacy"
            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center gap-1.5 text-slate-600 hover:bg-slate-100 transition-all no-underline"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Integritet
          </a>

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

      {suggestionOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kom med förslag"
          className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={() => { if (suggestionState !== "sending") setSuggestionOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base font-semibold text-slate-800">Kom med förslag</h2>
              <button
                onClick={() => { if (suggestionState !== "sending") setSuggestionOpen(false); }}
                className="text-slate-400 hover:text-slate-600 -mt-1 -mr-1 p-1"
                aria-label="Stäng"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Saknas en uteservering, något som behöver fixas eller en idé? Skriv här.
            </p>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Ditt förslag…"
              autoFocus
              rows={5}
              maxLength={2000}
              disabled={suggestionState === "sending" || suggestionState === "sent"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none disabled:bg-slate-50"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                {suggestionState === "error" && "Kunde inte skicka. Försök igen."}
                {suggestionState === "sent" && "Tack! Förslag skickat ✓"}
              </span>
              <button
                onClick={submitSuggestion}
                disabled={!suggestionText.trim() || suggestionState === "sending" || suggestionState === "sent"}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {suggestionState === "sending" ? "Skickar…" : suggestionState === "sent" ? "Skickat" : "Skicka in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  filter, onFilterChange, typeFilter, onTypeFilterChange, sunRange, onSunRangeChange,
  showShadows, onToggleShadows, showMetro, onToggleMetro, showRain, onToggleRain,
  wheelchairOnly, onWheelchairOnlyChange,
  metroStation, onMetroStationChange,
  openNowFilter, onOpenNowFilterChange,
  venues, onSelectVenue, hour, dateKey, getStatus, getClosestDateKey,
}: HeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(true);

  function toggleType(type: VenueType) {
    const next = new Set(typeFilter);
    if (next.has(type)) next.delete(type); else next.add(type);
    onTypeFilterChange(next);
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-[1100] pointer-events-none">
      {/* Centered top stack — wide card + filter row.
          Pushed down by safe-area-inset-top so the card hangs below the
          iPhone notch instead of behind it (statusBarStyle=black-translucent
          + viewportFit=cover would otherwise overlap it). */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto select-none" style={{ top: "var(--safe-top, 0px)" }}>

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
            boxShadow: "0 6px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
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
            showRain={showRain}
            onToggleRain={onToggleRain}
            wheelchairOnly={wheelchairOnly}
            onWheelchairOnlyChange={onWheelchairOnlyChange}
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

          <FavoritesPanel venues={venues} onSelectVenue={onSelectVenue} hour={hour} dateKey={dateKey} getStatus={getStatus} getClosestDateKey={getClosestDateKey} embedded />
        </div>

        {/* Filter row + collapse toggle */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* marginBottom collapse — no overflow:hidden so backdrop-filter has no ghost box and buttons aren't clipped */}
          <div
            data-onboarding="filter-row"
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
                    aria-label={`Filter ${label}`}
                    aria-pressed={typeFilter.has(type)}
                    className="rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
                    style={{
                      width: 40,
                      height: 40,
                      background: active
                        ? "linear-gradient(160deg, rgba(251,146,60,0.45) 0%, rgba(245,158,11,0.28) 60%, rgba(255,255,255,0.12) 100%)"
                        : "rgba(255,255,255,0.14)",
                      backdropFilter: "blur(16px) saturate(1.5)",
                      WebkitBackdropFilter: "blur(16px) saturate(1.5)",
                      border: active
                        ? "1px solid rgba(251,146,60,0.75)"
                        : "0.5px solid rgba(255,255,255,0.45)",
                      boxShadow: active
                        ? "0 0 0 1px rgba(251,146,60,0.35), 0 0 14px rgba(251,146,60,0.6), 0 0 28px rgba(251,146,60,0.3), inset 0 1px 1px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.08)"
                        : "0 2px 8px rgba(0,0,0,0.06)",
                      color: active ? "#9a3412" : "#888",
                      opacity: active ? 1 : 0.65,
                      transform: "translateZ(0)",
                      isolation: "isolate",
                      flexShrink: 0,
                    }}
                  >
                    <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, color: active ? "#9a3412" : "rgba(0,0,0,0.65)" }}>
                      {label}
                    </span>
                  </button>
                );
              })}

            {/* Öppet nu-knapp — kräver att hours fetchas för viewport-venues,
                så markörer kan dröja någon sekund innan stängda försvinner. */}
            <button
              onClick={() => onOpenNowFilterChange(!openNowFilter)}
              title="Öppet just nu"
              aria-label="Filter Öppet just nu"
              aria-pressed={openNowFilter}
              className="rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
              style={{
                width: 40,
                height: 40,
                background: openNowFilter
                  ? "linear-gradient(160deg, rgba(251,146,60,0.45) 0%, rgba(245,158,11,0.28) 60%, rgba(255,255,255,0.12) 100%)"
                  : "rgba(255,255,255,0.14)",
                backdropFilter: "blur(16px) saturate(1.5)",
                WebkitBackdropFilter: "blur(16px) saturate(1.5)",
                border: openNowFilter
                  ? "1px solid rgba(251,146,60,0.75)"
                  : "0.5px solid rgba(255,255,255,0.45)",
                boxShadow: openNowFilter
                  ? "0 0 0 1px rgba(251,146,60,0.35), 0 0 14px rgba(251,146,60,0.6), 0 0 28px rgba(251,146,60,0.3), inset 0 1px 1px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.08)"
                  : "0 2px 8px rgba(0,0,0,0.06)",
                color: openNowFilter ? "#9a3412" : "#888",
                opacity: openNowFilter ? 1 : 0.65,
                transform: "translateZ(0)",
                isolation: "isolate",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, color: openNowFilter ? "#9a3412" : "rgba(0,0,0,0.65)" }}>
                Öppet
              </span>
            </button>

            {/* T-bana-knapp — togglar metro-overlay */}
            <button
              onClick={() => onToggleMetro()}
              title="Tunnelbana"
              aria-label="Visa tunnelbanenät"
              aria-pressed={showMetro}
              className="rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
              style={{
                width: 40,
                height: 40,
                background: showMetro
                  ? "linear-gradient(160deg, rgba(251,146,60,0.45) 0%, rgba(245,158,11,0.28) 60%, rgba(255,255,255,0.12) 100%)"
                  : "rgba(255,255,255,0.14)",
                backdropFilter: "blur(16px) saturate(1.5)",
                WebkitBackdropFilter: "blur(16px) saturate(1.5)",
                border: showMetro
                  ? "1px solid rgba(251,146,60,0.75)"
                  : "0.5px solid rgba(255,255,255,0.45)",
                boxShadow: showMetro
                  ? "0 0 0 1px rgba(251,146,60,0.35), 0 0 14px rgba(251,146,60,0.6), 0 0 28px rgba(251,146,60,0.3), inset 0 1px 1px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.08)"
                  : "0 2px 8px rgba(0,0,0,0.06)",
                color: showMetro ? "#9a3412" : "#888",
                opacity: showMetro ? 1 : 0.65,
                transform: "translateZ(0)",
                isolation: "isolate",
                flexShrink: 0,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 2, lineHeight: 1 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "#e3000b" }} />
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "#00a14e" }} />
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "#0065bd" }} />
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, color: showMetro ? "#9a3412" : "rgba(0,0,0,0.65)" }}>
                T-bana
              </span>
            </button>
          </div>

          {/* Collapse / expand toggle — chevron ∧ when open (pointing up = hide), ∨ when closed (pointing down = show) */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            title={filtersOpen ? "Dölj filter" : "Visa filter"}
            aria-label={filtersOpen ? "Dölj filterraden" : "Visa filterraden"}
            aria-expanded={filtersOpen}
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
