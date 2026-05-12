"use client";

import { useEffect, useRef, useState } from "react";
import { getFavorites, saveFavorites } from "../lib/favorites";
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from "../lib/push";

type HoursResult = { openNow: boolean | null; closesAt: string | null } | null;

interface FavoritesPanelProps {
  venues: { id: string; name: string; type: string; address: string; lat: number; lng: number }[];
  onSelectVenue: (id: string) => void;
  hour: number;
  dateKey: string;
  getStatus: (venue: any, dateKey: string, hour: number) => string | undefined;
  embedded?: boolean;
}

function sunStyle(raw: string | undefined) {
  if (raw === "s" || raw === "sun")      return { dot: "#f59e0b", bg: "#fef3c7", text: "#92400e", label: "Sol" };
  if (raw === "p" || raw === "partial")  return { dot: "#fb923c", bg: "#ffedd5", text: "#9a3412", label: "Delvis" };
  if (raw === "d" || raw === "shade")    return { dot: "#94a3b8", bg: "#f1f5f9", text: "#475569", label: "Skugga" };
  return { dot: "#cbd5e1", bg: "#f8fafc", text: "#94a3b8", label: "Natt" };
}

export default function FavoritesPanel({ venues, onSelectVenue, hour, dateKey, getStatus, embedded }: FavoritesPanelProps) {
  const [open, setOpen] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [hoursMap, setHoursMap] = useState<Map<string, HoursResult | "loading">>(new Map());
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
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
        {/* Heart icon — matches hamburger SVG style; filled when there are favorites */}
        <svg
          width={embedded ? 22 : 16}
          height={embedded ? 20 : 14}
          viewBox="0 0 24 24"
          fill={favIds.size > 0 ? "#ef4444" : "none"}
          stroke={favIds.size > 0 ? "#ef4444" : "#475569"}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {favIds.size > 0 && (
          <span className={embedded
            ? "absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow"
            : "bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"}>
            {favIds.size}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 rounded-xl p-2 min-w-[260px] max-w-[300px] z-[2000] ${embedded ? "right-0" : "left-0"}`}
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "0.5px solid rgba(255,255,255,0.7)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            transform: "translateZ(0)",
            isolation: "isolate",
          }}
        >
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide px-1 mb-1.5">
            Mina favoriter ({favIds.size})
          </div>

          {favoriteVenues.length === 0 ? (
            <div className="text-xs text-slate-400 px-2 py-3 text-center">
              Inga favoriter än.
              <br />
              Tryck på hjärtat i en popup för att spara.
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
    </div>
  );
}
