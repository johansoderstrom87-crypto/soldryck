"use client";

import { useEffect, useRef, useState } from "react";
import { getFavorites, saveFavorites } from "../lib/favorites";
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from "../lib/push";
import WeeklyPlanner from "./WeeklyPlanner";
import SyncFavoritesModal from "./SyncFavoritesModal";

type HoursResult = { openNow: boolean | null; closesAt: string | null } | null;
type TrendingItem = { id: string; name: string; lat: number; lng: number; type: string; rooftop?: boolean; count: number };

interface FavoritesPanelProps {
  venues: { id: string; name: string; type: string; address: string; lat: number; lng: number }[];
  onSelectVenue: (id: string) => void;
  hour: number;
  dateKey: string;
  getStatus: (venue: any, dateKey: string, hour: number) => string | undefined;
  /** Pipeline snap helper, threaded down so the weekly planner can build
      its own week without re-deriving it from `dateKey`. */
  getClosestDateKey: (date: Date) => string;
  embedded?: boolean;
  /** When defined, the panel runs in controlled mode: parent decides when
      it's open, no toggle button is rendered, and the panel positions
      itself as a fixed overlay below the top-left menu button. */
  controlledOpen?: boolean;
  onControlledClose?: () => void;
}

function sunStyle(raw: string | undefined) {
  if (raw === "s" || raw === "sun")      return { dot: "#f59e0b", bg: "#fef3c7", text: "#92400e", label: "Sol" };
  if (raw === "p" || raw === "partial")  return { dot: "#fb923c", bg: "#ffedd5", text: "#9a3412", label: "Delvis" };
  if (raw === "d" || raw === "shade")    return { dot: "#94a3b8", bg: "#f1f5f9", text: "#475569", label: "Skugga" };
  return { dot: "#cbd5e1", bg: "#f8fafc", text: "#94a3b8", label: "Natt" };
}

export default function FavoritesPanel({ venues, onSelectVenue, hour, dateKey, getStatus, getClosestDateKey, embedded, controlledOpen, onControlledClose }: FavoritesPanelProps) {
  // Controlled-läge: när controlledOpen är definierad styr parent open-state
  // och vi renderar bara panelen (ingen toggle-knapp). Annars behåller vi
  // den interna state-machine:n som tidigare.
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      if (!v) onControlledClose?.();
    } else {
      setInternalOpen(v);
    }
  };
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [hoursMap, setHoursMap] = useState<Map<string, HoursResult | "loading">>(new Map());
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setFavIds(getFavorites());
    getPushStatus().then(setPushEnabled);
    const onChange = () => setFavIds(getFavorites());
    window.addEventListener("soldryck-favorites-changed", onChange);
    return () => window.removeEventListener("soldryck-favorites-changed", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fetch the 24 h trending list when the panel opens. Cached server-side
  // for 1 min, so cheap to refetch. Silent if the request fails.
  useEffect(() => {
    if (!open) return;
    fetch("/api/trending")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTrending(d?.trending ?? []))
      .catch(() => setTrending([]));
  }, [open]);

  // Fetch opening hours when panel opens
  useEffect(() => {
    if (!open) return;
    const favoriteVenues = venues.filter((v) => favIds.has(v.id));
    for (const v of favoriteVenues) {
      if (hoursMap.has(v.id)) continue;
      setHoursMap((prev) => new Map(prev).set(v.id, "loading"));
      const params = new URLSearchParams({ id: v.id, name: v.name, lat: String(v.lat), lng: String(v.lng), type: v.type });
      fetch(`/api/venue-hours?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: HoursResult) => setHoursMap((prev) => new Map(prev).set(v.id, data)))
        .catch(() => setHoursMap((prev) => new Map(prev).set(v.id, null)));
    }
  }, [open, favIds, venues]); // eslint-disable-line react-hooks/exhaustive-deps

  const favoriteVenues = venues.filter((v) => favIds.has(v.id));

  function removeFavorite(id: string) {
    const next = new Set(favIds);
    next.delete(id);
    saveFavorites(next);
    setFavIds(next);
  }

  async function handleTogglePush() {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
      } else {
        const ok = await subscribeToPush(Array.from(favIds));
        setPushEnabled(ok);
      }
    } finally {
      setPushBusy(false);
    }
  }

  // Controlled-mode placeringen — overlay strax under top-left menyknappen.
  // pointer-events: auto är load-bearing: Header-wrappern är pointer-events:
  // none så bara explicit valda barn tar klick. Utan detta blev panelen
  // synlig men oklickbar (alla klick gick rakt igenom till kartan).
  const controlledStyle: React.CSSProperties = {
    position: "fixed",
    top: "calc(var(--safe-top, 0px) + 72px)",
    left: "calc(var(--safe-left, 0px) + 12px)",
    width: 300,
    maxWidth: "calc(100vw - 24px)",
    maxHeight: "calc(100vh - 100px)",
    overflowY: "auto",
    pointerEvents: "auto",
  };

  return (
    <div ref={ref} className={isControlled ? undefined : "relative"}>
      {/* Toggle-knappen renderas inte i controlled mode — parent sköter
          öppna/stäng via menypost i hamburgermenyn. */}
      {!isControlled && (
        <button
          ref={btnRef}
          aria-label={`Favoriter${favIds.size > 0 ? ` (${favIds.size} sparade)` : ""}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => {
            if (embedded && btnRef.current) {
              const r = btnRef.current.getBoundingClientRect();
              const W = 268;
              const margin = 8;
              const left = Math.max(margin, Math.min(r.right - W, window.innerWidth - W - margin));
              setDropdownPos({ top: r.bottom + 6, left });
            }
            setOpen(!open);
          }}
          className={embedded
            ? "rounded-xl flex items-center justify-center transition-all hover:bg-white/40 relative"
            : "rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all text-slate-700"}
          style={embedded ? {
            width: 32,
            height: 32,
          } : {
            background: "rgba(255,255,255,0.3)",
            backdropFilter: "blur(14px) saturate(1.3)",
            WebkitBackdropFilter: "blur(14px) saturate(1.3)",
            border: "0.5px solid rgba(255,255,255,0.55)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            transform: "translateZ(0)",
            isolation: "isolate",
          }}
          title="Mina favoriter"
        >
          <svg
            width={embedded ? 22 : 16}
            height={embedded ? 20 : 14}
            viewBox="0 0 24 24"
            fill={favIds.size > 0 ? "#f59e0b" : "none"}
            stroke={favIds.size > 0 ? "#f59e0b" : "#475569"}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {favIds.size > 0 && (
            <span
              className={embedded
                ? "absolute -top-1 -right-1 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow"
                : "text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"}
              style={{ background: "#f59e0b" }}
            >
              {favIds.size}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className={`rounded-xl p-2 z-[2000] ${isControlled || embedded ? "" : "absolute top-full mt-1 left-0 min-w-[260px] max-w-[300px]"}`}
          style={{
            ...(isControlled
              ? controlledStyle
              : embedded && dropdownPos
                ? { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: 268 }
                : {}),
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "0.5px solid rgba(255,255,255,0.7)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            transform: "translateZ(0)",
            isolation: "isolate",
          }}
        >
          {/* Trending section — top of dropdown, only when we have data
              and the user hasn't already opened the panel from a sun-empty
              state. Charm before utility. */}
          {trending.length > 0 && (
            <>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide px-1 mb-1.5 flex items-center gap-1.5">
                <span aria-hidden>🔥</span>
                <span>Trending senaste dygnet</span>
              </div>
              <div className="flex flex-col gap-0.5 mb-2">
                {trending.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onSelectVenue(t.id); setOpen(false); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-white/60 transition-colors"
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #fb923c, #f59e0b)", fontSize: 10, color: "#fff", fontWeight: 800 }}
                      aria-hidden
                    >
                      {trending.indexOf(t) + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate flex-1">{t.name}</span>
                    {t.rooftop && (
                      <span className="text-[9px] text-purple-600 font-bold flex-shrink-0">↑ Takbar</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-200 my-1.5" />
            </>
          )}

          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide px-1 mb-1.5">
            Mina favoriter ({favIds.size})
          </div>

          {favoriteVenues.length === 0 ? (
            <div className="px-3 py-5 text-center">
              <div
                style={{
                  width: 56, height: 56, margin: "0 auto 10px",
                  borderRadius: "50%",
                  background: "linear-gradient(160deg, rgba(254,243,199,0.9), rgba(255,237,213,0.8))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, lineHeight: 1,
                  boxShadow: "0 4px 12px rgba(245,158,11,0.18)",
                }}
                aria-hidden
              >
                ☀️
              </div>
              <div className="text-[13px] font-semibold text-slate-700 mb-1">
                Inga favoriter än
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Tryck <span style={{ color: "#ef4444" }}>♡</span> i en popup för att spara ett ställe — så når du dem härifrån med ett klick.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[320px] overflow-y-auto">
              {favoriteVenues.map((v) => {
                const raw = getStatus(v as any, dateKey, hour);
                const sun = sunStyle(raw);
                const hours = hoursMap.get(v.id);
                return (
                  <div
                    key={v.id}
                    className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-white/60 cursor-pointer group transition-colors"
                    onClick={() => { onSelectVenue(v.id); setOpen(false); }}
                  >
                    {/* Sun dot */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sun.dot }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs font-semibold text-slate-700 truncate flex-1">{v.name}</div>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: sun.bg, color: sun.text }}
                        >
                          {sun.label}
                        </span>
                      </div>
                      {v.address && (
                        <div className="text-[9px] text-slate-400 truncate mt-0.5">{v.address}</div>
                      )}
                      {hours === "loading" && (
                        <div className="text-[9px] text-slate-300 mt-0.5">Hämtar öppettider…</div>
                      )}
                      {hours && hours !== "loading" && hours.openNow !== null && (
                        <div className={`text-[9px] mt-0.5 font-medium ${hours.openNow ? "text-green-600" : "text-slate-400"}`}>
                          {hours.openNow
                            ? `Öppet${hours.closesAt ? ` · stänger ${hours.closesAt}` : ""}`
                            : "Stängt just nu"}
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFavorite(v.id); }}
                      className="flex-shrink-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none pt-0.5"
                      title="Ta bort"
                      aria-label={`Ta bort ${v.name} från favoriter`}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {favoriteVenues.length > 0 && (
            <>
              <div className="border-t border-slate-200 my-1.5" />
              <button
                onClick={() => { setOpen(false); setPlannerOpen(true); }}
                className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="flex-1">Veckoplan — när är det sol?</span>
              </button>
              <button
                onClick={() => { setOpen(false); setSyncOpen(true); }}
                className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <polyline points="21 4 21 12 13 12" />
                </svg>
                <span className="flex-1">Synka till andra enheter</span>
              </button>
              <button
                onClick={handleTogglePush}
                disabled={pushBusy}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                  pushEnabled
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span>{pushEnabled ? "☀️" : "🔔"}</span>
                <span className="flex-1">
                  {pushEnabled ? "Notiser på" : "Notifiera mig när favoriter har sol"}
                </span>
              </button>
            </>
          )}
        </div>
      )}

      {plannerOpen && (
        <WeeklyPlanner
          venues={favoriteVenues}
          getStatus={getStatus}
          getClosestDateKey={getClosestDateKey}
          onClose={() => setPlannerOpen(false)}
          onSelectVenue={(id) => { onSelectVenue(id); setPlannerOpen(false); }}
        />
      )}

      {syncOpen && <SyncFavoritesModal onClose={() => setSyncOpen(false)} />}
    </div>
  );
}
