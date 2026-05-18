"use client";

import { useMemo, useState, useEffect } from "react";
import { snapToSeason } from "../lib/season";

type NormalizedStatus = "sun" | "shade" | "partial" | "night";

interface WeeklyPlannerProps {
  /** Favourite venues to plan for — array of full venue objects. */
  venues: { id: string; name: string; lat: number; lng: number; type: string; address?: string }[];
  onClose: () => void;
  /** Caller flies to the venue on the map. */
  onSelectVenue: (id: string) => void;
  getStatus: (venue: any, dateKey: string, hour: number) => string | undefined;
  getClosestDateKey: (date: Date) => string;
}

function normalize(s: string | undefined): NormalizedStatus {
  if (s === "s" || s === "sun") return "sun";
  if (s === "p" || s === "partial") return "partial";
  if (s === "n" || s === "night") return "night";
  return "shade";
}

const DAY_NAMES = ["SÖN", "MÅN", "TIS", "ONS", "TOR", "FRE", "LÖR"];
const MONTH_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

function countSunHours(
  venue: any,
  dateKey: string,
  getStatus: (v: any, dk: string, h: number) => string | undefined,
): number {
  let n = 0;
  for (const h of HOURS) {
    const s = normalize(getStatus(venue, dateKey, h));
    if (s === "sun" || s === "partial") n++;
  }
  return n;
}

export default function WeeklyPlanner({
  venues, onClose, onSelectVenue, getStatus, getClosestDateKey,
}: WeeklyPlannerProps) {
  // Anchor week-start to today (or the next in-season date if we're outside
  // April–October — otherwise every day's grid would be flat-grey).
  const days = useMemo(() => {
    const start = (() => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return snapToSeason(t);
    })();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedDay = days[selectedIdx];
  const selectedDateKey = useMemo(() => getClosestDateKey(selectedDay), [selectedDay, getClosestDateKey]);

  // Sun-hour score per day across all favourites — drives the day-pill heat
  // background AND the "solsäkraste dag"-suggestion at the top.
  const sunByDay = useMemo(() => {
    return days.map((d) => {
      const key = getClosestDateKey(d);
      let total = 0;
      for (const v of venues) total += countSunHours(v, key, getStatus);
      return total;
    });
  }, [days, venues, getStatus, getClosestDateKey]);

  const bestDayIdx = useMemo(() => {
    let bi = 0, bv = -1;
    for (let i = 0; i < sunByDay.length; i++) {
      if (sunByDay[i] > bv) { bv = sunByDay[i]; bi = i; }
    }
    return bi;
  }, [sunByDay]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxSun = Math.max(1, ...sunByDay);

  return (
    <div
      role="dialog"
      aria-label="Veckoplanerare"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "calc(16px + var(--safe-top, 0px)) 12px calc(16px + var(--safe-bottom, 0px))",
        fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
        animation: "wp-fade 0.2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          alignSelf: "stretch",
          background: "rgba(255,255,255,0.97)",
          borderRadius: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 18px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Veckoplanerare
            </h2>
            <button
              onClick={onClose}
              aria-label="Stäng"
              style={{
                width: 30, height: 30, border: "none",
                background: "rgba(15,23,42,0.05)",
                borderRadius: 10, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#64748b",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="3" x2="11" y2="11" />
                <line x1="11" y1="3" x2="3" y2="11" />
              </svg>
            </button>
          </div>
          {venues.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Spara favoriter först — så jämför vi solen för veckan här.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
              Solsäkraste dag bland dina favoriter:{" "}
              <strong style={{ color: "#b45309" }}>
                {DAY_NAMES[days[bestDayIdx].getDay()].toLowerCase()} {days[bestDayIdx].getDate()} {MONTH_SHORT[days[bestDayIdx].getMonth()]}
              </strong>
            </div>
          )}
        </div>

        {/* Day pills with sun-hour heat under each */}
        {venues.length > 0 && (
          <div style={{ padding: "10px 12px 6px", display: "flex", gap: 4, overflowX: "auto" }}>
            {days.map((d, i) => {
              const isSelected = i === selectedIdx;
              const isBest = i === bestDayIdx && bestDayIdx !== selectedIdx;
              const heatRatio = sunByDay[i] / maxSun;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 54,
                    padding: "6px 8px",
                    borderRadius: 12,
                    border: isSelected
                      ? "1px solid rgba(251,146,60,0.7)"
                      : isBest
                      ? "1px dashed rgba(251,146,60,0.5)"
                      : "0.5px solid rgba(0,0,0,0.08)",
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(251,146,60,0.25), rgba(245,158,11,0.18))"
                      : "rgba(248,250,252,0.7)",
                    cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em" }}>
                    {DAY_NAMES[d.getDay()]}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
                    {d.getDate()}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 24,
                      height: 4,
                      borderRadius: 2,
                      background: `linear-gradient(90deg, #fbbf24 ${heatRatio * 100}%, rgba(0,0,0,0.05) ${heatRatio * 100}%)`,
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Favourite list — each row shows sun bars for the selected day */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px 14px" }}>
          {venues.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden>📅</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                Inga favoriter än
              </div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, maxWidth: 240, margin: "0 auto" }}>
                Tryck <span style={{ color: "#ef4444" }}>♡</span> i en popup för att spara — sen kan du jämföra dem här.
              </div>
            </div>
          ) : (
            venues.map((v) => (
              <FavoriteRow
                key={v.id}
                venue={v}
                dateKey={selectedDateKey}
                getStatus={getStatus}
                onSelect={() => onSelectVenue(v.id)}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes wp-fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

function FavoriteRow({
  venue, dateKey, getStatus, onSelect,
}: {
  venue: { id: string; name: string; type: string; address?: string };
  dateKey: string;
  getStatus: (v: any, dk: string, h: number) => string | undefined;
  onSelect: () => void;
}) {
  const sunHours = countSunHours(venue, dateKey, getStatus);

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        marginBottom: 6,
        borderRadius: 12,
        background: "rgba(248,250,252,0.6)",
        border: "0.5px solid rgba(0,0,0,0.06)",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#0f172a",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
        }}>
          {venue.name}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: sunHours > 0 ? "#b45309" : "#94a3b8",
          background: sunHours > 0 ? "#fef3c7" : "#f1f5f9",
          padding: "2px 7px", borderRadius: 999, flexShrink: 0,
        }}>
          {sunHours > 0 ? `${sunHours}h sol` : "ingen sol"}
        </div>
      </div>

      {/* Sun bars 7–22 */}
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
        {HOURS.map((h) => {
          const s = normalize(getStatus(venue, dateKey, h));
          let bg: string;
          if (s === "sun") {
            const dist = Math.abs(h - 13);
            if (dist >= 6) bg = "linear-gradient(180deg,#fef9c3,#fde68a)";
            else if (dist >= 4) bg = "linear-gradient(180deg,#fde68a,#fbbf24)";
            else if (dist >= 2) bg = "linear-gradient(180deg,#fbbf24,#f59e0b)";
            else bg = "linear-gradient(180deg,#f59e0b,#ea580c)";
          } else if (s === "partial") {
            bg = "linear-gradient(135deg,#fed7aa,#fb923c)";
          } else if (s === "night") {
            bg = "#1e293b";
          } else {
            bg = "#e2e8f0";
          }
          return (
            <div
              key={h}
              title={`${h}:00`}
              style={{ flex: 1, height: 14, borderRadius: 3, background: bg, minWidth: 0 }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
        {HOURS.map((h) => (
          <div key={h} style={{ flex: 1, textAlign: "center", fontSize: 7, color: "#94a3b8", minWidth: 0 }}>
            {h}
          </div>
        ))}
      </div>
    </button>
  );
}
