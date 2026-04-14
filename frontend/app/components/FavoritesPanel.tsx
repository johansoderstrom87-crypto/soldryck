"use client";

import { useEffect, useRef, useState } from "react";
import { getFavorites, saveFavorites } from "../lib/favorites";
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from "../lib/push";

interface FavoritesPanelProps {
  venues: { id: string; name: string; type: string; address: string; lat: number; lng: number }[];
  onSelectVenue: (id: string) => void;
}

export default function FavoritesPanel({ venues, onSelectVenue }: FavoritesPanelProps) {
  const [open, setOpen] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
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
        className="rounded-xl shadow-lg backdrop-blur-md px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all bg-white/95 text-slate-600 hover:bg-white"
        title="Mina favoriter"
      >
        <span className="text-red-500">{favIds.size > 0 ? "\u2764\uFE0F" : "\u2661"}</span>
        {favIds.size > 0 && (
          <span className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
            {favIds.size}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white/95 backdrop-blur-md rounded-xl shadow-lg p-2 min-w-[240px] max-w-[280px] z-10">
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
            <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
              {favoriteVenues.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 group"
                >
                  <button
                    onClick={() => {
                      onSelectVenue(v.id);
                      setOpen(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="text-xs font-medium text-slate-700 truncate">{v.name}</div>
                    {v.address && (
                      <div className="text-[9px] text-slate-400 truncate">{v.address}</div>
                    )}
                  </button>
                  <button
                    onClick={() => removeFavorite(v.id)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                    title="Ta bort"
                  >
                    &times;
                  </button>
                </div>
              ))}
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
                <span>{pushEnabled ? "\u2600\uFE0F" : "\uD83D\uDD14"}</span>
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
