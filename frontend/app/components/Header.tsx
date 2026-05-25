"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { type VenueType, type SunRange } from "./SunMap";
import { METRO_STATIONS, type MetroStation } from "../data/metro-stations";
import FavoritesPanel from "./FavoritesPanel";
import { getFavorites } from "../lib/favorites";

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

// Huvudkategorier (OR-logik). Renderas till vänster om divider:n.
// Bar-knappen matchar venue.type === bar/pub/biergarten — alla "drink-
// ställen" — och är skild från Glas, som är en AND-modifier för
// serveringstillstånd.
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
    label: "Bar",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>`,
  },
  {
    type: "rooftop",
    label: "Takbar",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><line x1="3" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="21" y2="7"/></svg>`,
  },
];

// Glas — AND-modifier som snävar in på platser med serveringstillstånd.
// Skild från Bar (som är venue.type-filter) sedan användartest visade att
// dubbelrollen "Bar är både kategori och alkoholfilter" var rörig.
const ALCOHOL_MODIFIER_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 7c0-1.5 1-3 3-3"/><path d="M12 15v6"/><path d="M9 21h6"/></svg>`;

// Filterraden — ett modernt glas-system där varje knapp har en mjuk
// top-down gradient (ljus i topp, mörkare nedåt) plus en inset top-
// highlight. Det gör att knappen läser som ett tunt glas-kort som
// fångar ljuset, inte en flat färgplatta. Glaset är detsamma oavsett
// aktivt läge — det är ikonen och etiketten som tänds upp när knappen
// väljs, inte hela ytan. På så sätt behåller raden sin lätta, neutrala
// karaktär även när flera filter är på samtidigt.
const FILTER_BTN_BG =
  "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.10) 100%)";
const FILTER_BTN_BORDER = "0.5px solid rgba(255,255,255,0.55)";
const FILTER_BTN_ACTIVE_BG = "radial-gradient(ellipse at 50% 38%, #ffc896 0%, #fb9040 48%, #ef6e2c 100%)";
const MODIFIER_BTN_ACTIVE_BG = "linear-gradient(145deg, #c0cdf0 0%, #7080c8 100%)";
const FILTER_BTN_ACTIVE_BORDER = "none";
const FILTER_BTN_ACTIVE_SHADOW = "0 2px 10px rgba(120,53,15,0.22)";
const FILTER_BTN_ACTIVE_ICON_COLOR = "#fff";
const FILTER_BTN_ACTIVE_ICON_FILTER = undefined;
const FILTER_BTN_SHADOW =
  "0 8px 22px rgba(15,23,42,0.14), " +
  "0 1px 3px rgba(15,23,42,0.08), " +
  "inset 0 1px 0.5px rgba(255,255,255,0.65), " +
  "inset 0 -1px 0.5px rgba(15,23,42,0.05)";

// Aktiv huvudkategori (Äta/Fika/Bar/Takbar): ikonen lyser i eldig
// orange via två-stegs drop-shadow (tight glöd + bredare bloom).
// Etiketten matchar i samma färg med en mjuk text-shadow så den
// glöder lite men ändå läses skarpt.
const ORANGE_ACTIVE_TEXT = "#ea580c";
const ORANGE_GLOW_FILTER =
  "drop-shadow(0 0 4px rgba(251,146,60,0.90)) " +
  "drop-shadow(0 0 10px rgba(234,88,12,0.55))";
const ORANGE_GLOW_TEXT_SHADOW = "0 0 6px rgba(251,146,60,0.50)";

// Aktiv modifier (Glas/Öppet/T-bana): samma idé som orange men i blå
// palett för att signalera "snäva in/lägg på" snarare än "välj kategori".
const BLUE_ACTIVE_TEXT = "#2563eb";
const BLUE_GLOW_FILTER =
  "drop-shadow(0 0 4px rgba(96,165,250,0.90)) " +
  "drop-shadow(0 0 10px rgba(37,99,235,0.55))";
const BLUE_GLOW_TEXT_SHADOW = "0 0 6px rgba(96,165,250,0.50)";

// Feature flag — Hund/Glutenfri-filter är paused tills vi kan köra steg 11
// (Google Places backfill). OSM-täckningen i steg 10 ger bara 1 hund + 18
// glutenfri av 2 844 venues, vilket gör filtren meningslösa. Hela
// infrastrukturen (props, state, pipeline, typer, filterlogik) är på plats
// — flippa till `true` när Google-datan finns. Se CLAUDE.md sektionen
// "Hund/Glutenfri — paused" för planen att återuppta.
const DOG_GLUTEN_FILTERS_ENABLED = false;

const vibrate = (ms = 6) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
};

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
  dogFriendlyOnly: boolean;
  onDogFriendlyOnlyChange: (v: boolean) => void;
  glutenFreeOnly: boolean;
  onGlutenFreeOnlyChange: (v: boolean) => void;
  metroStation: MetroStation | null;
  onMetroStationChange: (station: MetroStation | null) => void;
  openNowFilter: boolean;
  onOpenNowFilterChange: (v: boolean) => void;
  alcoholOnly: boolean;
  onAlcoholOnlyChange: (v: boolean) => void;
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
  dogFriendlyOnly, onDogFriendlyOnlyChange,
  glutenFreeOnly, onGlutenFreeOnlyChange,
  onOpenFavorites,
  favoritesCount,
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
  dogFriendlyOnly: boolean;
  onDogFriendlyOnlyChange: (v: boolean) => void;
  glutenFreeOnly: boolean;
  onGlutenFreeOnlyChange: (v: boolean) => void;
  /** Opens the favorites panel — replaces the old standalone favorites button. */
  onOpenFavorites?: () => void;
  /** Number of saved favorites — shown as a small badge on the menu item. */
  favoritesCount?: number;
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

  // Default-tillståndet är Äta + Bar + Takbar (Fika av — caféer dominerade
  // datasetet och skymde mer aktiva ställen). Badgen ska inte räkna det
  // som "aktivt filter" — bara avvikelser från default (något bortvalt,
  // tom uppsättning, eller annat subset än default) flaggas.
  const typeFilterIsDefault =
    typeFilter.size === 3 &&
    typeFilter.has("restaurant") &&
    typeFilter.has("bar") && typeFilter.has("rooftop");

  const activeCount =
    (filter !== "all" ? 1 : 0) +
    (typeFilterIsDefault ? 0 : 1) +
    (metroStation ? 1 : 0) +
    (showShadows ? 1 : 0) +
    (showMetro ? 1 : 0) +
    (showRain ? 1 : 0) +
    (wheelchairOnly ? 1 : 0) +
    (DOG_GLUTEN_FILTERS_ENABLED && dogFriendlyOnly ? 1 : 0) +
    (DOG_GLUTEN_FILTERS_ENABLED && glutenFreeOnly ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { vibrate(); setOpen(!open); }}
        aria-label={open ? "Stäng meny" : `Meny${activeCount > 0 ? ` (${activeCount} aktiva filter)` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center justify-center transition-all relative active:scale-95"
        style={{
          width: 52,
          height: 52,
          borderRadius: 9999,
          background: "rgba(255,255,255,0.55)",
          border: "0.5px solid rgba(255,255,255,0.7)",
          boxShadow: "0 6px 20px rgba(245,158,11,0.18), 0 2px 6px rgba(0,0,0,0.08)",
          padding: 4,
          transform: "translateZ(0)",
          isolation: "isolate",
        }}
        title="Meny"
      >
        {/* Soldryck pin-logo som primär identitet + meny-trigger */}
        <Image
          src="/soldryck_pin.png"
          alt="Soldryck"
          width={52}
          height={52}
          priority
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 1px 2px rgba(245,158,11,0.25))",
          }}
        />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow" style={{ background: "#f59e0b" }}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl p-1 min-w-[220px] z-[2000]" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", border: "0.5px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", transform: "translateZ(0)", isolation: "isolate" }}>

          {/* Logo header */}
          <div className="flex items-center gap-2 px-2 pt-2 pb-2.5">
            <Image
              src="/soldryck_pin.png"
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

          {/* Favoriter — toppvalbar entry. Stänger den här menyn och öppnar
              favoritpanelen via callback från parent (Header). */}
          {onOpenFavorites && (
            <>
              <button
                onClick={() => { setOpen(false); onOpenFavorites(); }}
                aria-label={`Favoriter${favoritesCount && favoritesCount > 0 ? ` (${favoritesCount} sparade)` : ""}`}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all text-slate-700 hover:bg-slate-100"
              >
                <span className="flex items-center gap-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={favoritesCount && favoritesCount > 0 ? "#f59e0b" : "none"}
                    stroke={favoritesCount && favoritesCount > 0 ? "#f59e0b" : "currentColor"}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  Favoriter
                </span>
                {favoritesCount && favoritesCount > 0 ? (
                  <span className="text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold" style={{ background: "#f59e0b" }}>
                    {favoritesCount}
                  </span>
                ) : null}
              </button>
              <div className="border-t border-slate-200 my-1" />
            </>
          )}

          {/* Sun/shade filter */}
          <div className="flex flex-col gap-0.5">
            {FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => { vibrate(); onFilterChange(o.value); }}
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
            onClick={() => { vibrate(); onToggleShadows(); }}
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
            onClick={() => { vibrate(); onToggleRain(); }}
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
            onClick={() => { vibrate(); onWheelchairOnlyChange(!wheelchairOnly); }}
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

          {/* Hundvänligt-toggle. Filter på venue.dogFriendly som sätts av
              pipeline steg 04 baserat på OSM `dog=*` ELLER Google `allowsDogs`.
              Samma "false positives är värre än inga träffar"-resonemang som
              Tillgängligt — när filtret är på döljs venues utan bekräftad
              hundvänlighet.

              Just nu wrappad i DOG_GLUTEN_FILTERS_ENABLED-flagga eftersom
              OSM-datan är för tunn för att vara meningsfull (1 hund av 2844).
              Se CLAUDE.md "Hund/Glutenfri — paused". */}
          {DOG_GLUTEN_FILTERS_ENABLED && (
          <button
            onClick={() => onDogFriendlyOnlyChange(!dogFriendlyOnly)}
            aria-pressed={dogFriendlyOnly}
            aria-label={dogFriendlyOnly ? "Visa alla ställen" : "Visa bara hundvänliga ställen"}
            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all ${
              dogFriendlyOnly ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {/* Paw — fyra tår + dyna */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <ellipse cx="6" cy="9" rx="1.8" ry="2.4" />
                <ellipse cx="10" cy="6" rx="1.8" ry="2.4" />
                <ellipse cx="14" cy="6" rx="1.8" ry="2.4" />
                <ellipse cx="18" cy="9" rx="1.8" ry="2.4" />
                <path d="M12 11c-3 0-5.5 2.4-5.5 5 0 2 1.5 3 3.5 3 1 0 1.3-.5 2-.5s1 .5 2 .5c2 0 3.5-1 3.5-3 0-2.6-2.5-5-5.5-5z" />
              </svg>
              Hundvänligt
            </span>
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${dogFriendlyOnly ? "bg-white/30" : "bg-slate-200"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${dogFriendlyOnly ? "translate-x-3" : "translate-x-0"}`} />
            </span>
          </button>
          )}

          {/* Glutenfritt-toggle. Filter på venue.glutenFree från pipeline steg
              04 — sant om OSM `diet:gluten_free=yes/limited/only` eller om ≥2
              Google-reviews nämner glutenfri-keywords. Wrappad i samma flagga
              som hundvänligt — se kommentar ovan. */}
          {DOG_GLUTEN_FILTERS_ENABLED && (
          <button
            onClick={() => onGlutenFreeOnlyChange(!glutenFreeOnly)}
            aria-pressed={glutenFreeOnly}
            aria-label={glutenFreeOnly ? "Visa alla ställen" : "Visa bara glutenfria ställen"}
            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all ${
              glutenFreeOnly ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {/* Vetex — överstruken */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20" />
                <path d="M8 5l4 3" />
                <path d="M16 5l-4 3" />
                <path d="M7 9l5 3" />
                <path d="M17 9l-5 3" />
                <path d="M7 13l5 3" />
                <path d="M17 13l-5 3" />
                <line x1="4" y1="20" x2="20" y2="4" />
              </svg>
              Glutenfritt
            </span>
            <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${glutenFreeOnly ? "bg-white/30" : "bg-slate-200"}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${glutenFreeOnly ? "translate-x-3" : "translate-x-0"}`} />
            </span>
          </button>
          )}

          {/* Tunnelbana toggle */}
          <button
            onClick={() => { vibrate(); onToggleMetro(); }}
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
                        onClick={() => { vibrate(); onMetroStationChange(s); setMetroOpen(false); setMetroSearch(""); }}
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
  dogFriendlyOnly, onDogFriendlyOnlyChange,
  glutenFreeOnly, onGlutenFreeOnlyChange,
  metroStation, onMetroStationChange,
  openNowFilter, onOpenNowFilterChange,
  alcoholOnly, onAlcoholOnlyChange,
  venues, onSelectVenue, hour, dateKey, getStatus, getClosestDateKey,
}: HeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Favoriter-panelen styrs nu från SettingsButton-dropdown (menyposten
  // "Favoriter"). Vi håller open-state här och passar den till
  // FavoritesPanel som rendreras separat, så panelen kan dyka upp
  // som en egen overlay istället för en knapp i toppraden.
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  useEffect(() => {
    const read = () => setFavCount(getFavorites().size);
    read();
    window.addEventListener("soldryck-favorites-changed", read);
    return () => window.removeEventListener("soldryck-favorites-changed", read);
  }, []);

  const [filterToast, setFilterToast] = useState<{ text: string; key: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showToast = (text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFilterToast({ text, key: Date.now() });
    toastTimerRef.current = setTimeout(() => setFilterToast(null), 2200);
  };

  const TYPE_TOAST: Record<string, string> = {
    restaurant: "Visar restauranger",
    cafe: "Visar kaféer",
    bar: "Visar barer & pubar",
    rooftop: "Visar takbarer",
  };

  function toggleType(type: VenueType) {
    vibrate();
    const next = new Set(typeFilter);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
      showToast(TYPE_TOAST[type] ?? "Filter aktiverat");
    }
    onTypeFilterChange(next);
  }

  return (
    <div className="absolute inset-0 z-[1100] pointer-events-none">
      {/* Top-left meny-knapp — standard övre vänster hörn, ovanför filterraden. */}
      <div
        className="absolute pointer-events-auto select-none"
        style={{
          top: "calc(var(--safe-top, 0px) + 20px)",
          left: "calc(var(--safe-left, 0px) + 12px)",
          zIndex: 20,
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
          dogFriendlyOnly={dogFriendlyOnly}
          onDogFriendlyOnlyChange={onDogFriendlyOnlyChange}
          glutenFreeOnly={glutenFreeOnly}
          onGlutenFreeOnlyChange={onGlutenFreeOnlyChange}
          onOpenFavorites={() => setFavoritesOpen(true)}
          favoritesCount={favCount}
        />
      </div>

      {/* Favoritpanel — kontrollerad av Header. Renderas som overlay,
          oberoende av menyknappen. */}
      <FavoritesPanel
        venues={venues}
        onSelectVenue={onSelectVenue}
        hour={hour}
        dateKey={dateKey}
        getStatus={getStatus}
        getClosestDateKey={getClosestDateKey}
        controlledOpen={favoritesOpen}
        onControlledClose={() => setFavoritesOpen(false)}
      />

      {/* Vertical filter sidebar — left side, below menu button.
          Flex-row: [button column] [collapse arrow].
          Negative marginRight on the column collapses the arrow to the
          left edge when hidden (same trick as marginBottom in the old
          horizontal layout). */}
      <div
        className="absolute flex flex-row items-center pointer-events-none select-none"
        style={{
          bottom: "calc(var(--safe-bottom, 0px) + 225px)",
          left: "calc(var(--safe-left, 0px) + 12px)",
          zIndex: 20,
          gap: 6,
          fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        }}
      >
        {/* Button column */}
        <div
          data-onboarding="filter-row"
          className="pointer-events-auto"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: filtersOpen ? 1 : 0,
            visibility: filtersOpen ? "visible" : "hidden",
            transform: filtersOpen ? "translateX(0)" : "translateX(-4px)",
            marginRight: filtersOpen ? 0 : -(50 + 6),
            pointerEvents: filtersOpen ? "auto" : "none",
            transition:
              "margin-right 0.26s ease, opacity 0.22s ease, transform 0.24s ease, " +
              "visibility 0s linear " + (filtersOpen ? "0s" : "0.24s"),
          }}
        >
          {/* Modifier buttons — T-bana, Öppet, Glas (top) */}
          <button
            onClick={() => { if (!showMetro) showToast("Visar ställen nära tunnelbana"); onToggleMetro(); }}
            title="Tunnelbana" aria-label="Visa tunnelbanenät" aria-pressed={showMetro}
            className="transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
            style={{
              width: 50, height: 50, borderRadius: 9999,
              background: showMetro ? MODIFIER_BTN_ACTIVE_BG : FILTER_BTN_BG,
              backdropFilter: "blur(18px) saturate(1.6)", WebkitBackdropFilter: "blur(18px) saturate(1.6)",
              border: showMetro ? FILTER_BTN_ACTIVE_BORDER : FILTER_BTN_BORDER,
              boxShadow: showMetro ? "0 2px 10px rgba(60,70,160,0.30)" : FILTER_BTN_SHADOW,
              color: showMetro ? "#fff" : "#475569", opacity: showMetro ? 1 : 0.82,
              transform: "translateZ(0)", isolation: "isolate", flexShrink: 0,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 2, lineHeight: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: showMetro ? "rgba(255,255,255,0.85)" : "#e3000b" }} />
              <span style={{ width: 5, height: 5, borderRadius: 999, background: showMetro ? "rgba(255,255,255,0.85)" : "#00a14e" }} />
              <span style={{ width: 5, height: 5, borderRadius: 999, background: showMetro ? "rgba(255,255,255,0.85)" : "#0065bd" }} />
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1, color: showMetro ? "#fff" : "#111827" }}>T-bana</span>
          </button>

          <button
            onClick={() => { if (!openNowFilter) showToast("Visar ställen öppna just nu"); onOpenNowFilterChange(!openNowFilter); }}
            title="Öppet just nu" aria-label="Filter Öppet just nu" aria-pressed={openNowFilter}
            className="transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
            style={{
              width: 50, height: 50, borderRadius: 9999,
              background: openNowFilter ? MODIFIER_BTN_ACTIVE_BG : FILTER_BTN_BG,
              backdropFilter: "blur(18px) saturate(1.6)", WebkitBackdropFilter: "blur(18px) saturate(1.6)",
              border: openNowFilter ? FILTER_BTN_ACTIVE_BORDER : FILTER_BTN_BORDER,
              boxShadow: openNowFilter ? "0 2px 10px rgba(60,70,160,0.30)" : FILTER_BTN_SHADOW,
              color: openNowFilter ? "#fff" : "#475569", opacity: openNowFilter ? 1 : 0.82,
              transform: "translateZ(0)", isolation: "isolate", flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1, color: openNowFilter ? "#fff" : "#111827" }}>Öppet</span>
          </button>

          <button
            onClick={() => { if (!alcoholOnly) showToast("Visar ställen med serveringstillstånd"); onAlcoholOnlyChange(!alcoholOnly); }}
            title="Bara ställen med serveringstillstånd"
            aria-label="Filter Glas — serveringstillstånd"
            aria-pressed={alcoholOnly}
            className="transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
            style={{
              width: 50, height: 50, borderRadius: 9999,
              background: alcoholOnly ? MODIFIER_BTN_ACTIVE_BG : FILTER_BTN_BG,
              backdropFilter: "blur(18px) saturate(1.6)", WebkitBackdropFilter: "blur(18px) saturate(1.6)",
              border: alcoholOnly ? FILTER_BTN_ACTIVE_BORDER : FILTER_BTN_BORDER,
              boxShadow: alcoholOnly ? "0 2px 10px rgba(60,70,160,0.30)" : FILTER_BTN_SHADOW,
              color: alcoholOnly ? "#fff" : "#475569", opacity: alcoholOnly ? 1 : 0.82,
              transform: "translateZ(0)", isolation: "isolate", flexShrink: 0,
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: ALCOHOL_MODIFIER_SVG }} style={{ display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1, color: alcoholOnly ? "#fff" : "#111827" }}>Glas</span>
          </button>

          {/* Horizontal divider between modifier and category buttons */}
          <div aria-hidden style={{ height: 1, width: 36, marginBlock: 2, background: "rgba(15,23,42,0.38)" }} />

          {/* Category buttons — Takbar, Bar, Fika, Äta (bottom) */}
          {[...TYPE_BUTTONS].reverse().map(({ type, label, svg }) => {
            const active = typeFilter.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                title={label}
                aria-label={`Filter ${label}`}
                aria-pressed={typeFilter.has(type)}
                className="transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
                style={{
                  width: 50, height: 50, borderRadius: 9999,
                  background: active ? FILTER_BTN_ACTIVE_BG : FILTER_BTN_BG,
                  backdropFilter: "blur(18px) saturate(1.6)", WebkitBackdropFilter: "blur(18px) saturate(1.6)",
                  border: active ? FILTER_BTN_ACTIVE_BORDER : FILTER_BTN_BORDER,
                  boxShadow: active ? FILTER_BTN_ACTIVE_SHADOW : FILTER_BTN_SHADOW,
                  color: active ? FILTER_BTN_ACTIVE_ICON_COLOR : "#475569",
                  opacity: active ? 1 : 0.82,
                  transform: "translateZ(0)", isolation: "isolate", flexShrink: 0,
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1, color: active ? "#fff" : "#111827" }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Collapse arrow — always visible, centered vertically by flex parent.
            ◁ when open (collapse), ▷ when closed (expand). */}
        <button
          className="pointer-events-auto"
          onClick={() => setFiltersOpen((v) => !v)}
          title={filtersOpen ? "Dölj filter" : "Visa filter"}
          aria-label={filtersOpen ? "Dölj filterkolumnen" : "Visa filterkolumnen"}
          aria-expanded={filtersOpen}
          style={{
            background: "rgba(255,255,255,0.28)",
            backdropFilter: "blur(14px) saturate(1.3)",
            WebkitBackdropFilter: "blur(14px) saturate(1.3)",
            border: "0.5px solid rgba(255,255,255,0.55)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            borderRadius: 999,
            width: 16,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transform: "translateZ(0)",
            isolation: "isolate",
            flexShrink: 0,
          }}
        >
          <svg
            width="6"
            height="10"
            viewBox="0 0 6 10"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: filtersOpen ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.25s ease",
            }}
          >
            <path d="M5 1L1 5L5 9" />
          </svg>
        </button>

        {/* Filter toast — fades in/out to the right of the arrow */}
        {filterToast && (
          <div style={{ position: "absolute", left: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 30 }}>
            <div
              key={filterToast.key}
              style={{
                animation: "filter-toast 2.2s ease forwards",
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(16px) saturate(1.3)",
                WebkitBackdropFilter: "blur(16px) saturate(1.3)",
                border: "0.5px solid rgba(255,255,255,0.7)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#0f172a",
                whiteSpace: "nowrap",
              }}
            >
              {filterToast.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
