"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { buildClosedStatus } from "../lib/venueHours";
import Sheet from "./Sheet";

type NormalizedStatus = "sun" | "shade" | "partial" | "night";
type SortMode = "sun-remaining" | "rating" | "sun-count" | "distance";

const photoCache = new Map<string, string | null>();
const hoursCache = new Map<string, any>();

function normalizeStatus(s: string | undefined): NormalizedStatus {
  switch (s) {
    case "s": case "sun": return "sun";
    case "p": case "partial": return "partial";
    case "n": case "night": return "night";
    default: return "shade";
  }
}

function typeLabel(type: string): string {
  return (
    { restaurant: "Restaurang", cafe: "Café", bar: "Bar", pub: "Pub", rooftop: "Takbar" }[type] ?? type
  );
}

function countSunHoursFrom(
  venue: any,
  dateKey: string,
  fromHour: number,
  getStatus: (v: any, dk: string, h: number) => string | undefined,
): number {
  let count = 0;
  for (let h = fromHour; h <= 22; h++) {
    if (normalizeStatus(getStatus(venue, dateKey, h)) === "sun") count++;
  }
  return count;
}

/** Sun diagram matching place card popup exactly — bars, hour labels, current-hour dot. */
function SunDiagram({
  venue, dateKey, hour, getStatus,
}: {
  venue: any;
  dateKey: string;
  hour: number;
  getStatus: (v: any, dk: string, h: number) => string | undefined;
}) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);

  return (
    <div style={{ background: "#f8fafc", borderRadius: 7, padding: "4px 5px", marginTop: 5 }}>
      {/* Bars — same heights and gradients as place card popup */}
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
        {hours.map((h) => {
          const s = normalizeStatus(getStatus(venue, dateKey, h));
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
          const isCurrent = h === hour;
          return (
            <div
              key={h}
              title={`${h}:00`}
              style={{
                flex: 1, borderRadius: 4, background: bg,
                height: isCurrent ? 17 : 13, minWidth: 0,
                boxShadow:
                  isCurrent && (s === "sun" || s === "partial")
                    ? "0 0 8px rgba(245,158,11,0.65)"
                    : undefined,
              }}
            />
          );
        })}
      </div>
      {/* Hour labels */}
      <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
        {hours.map((h) => (
          <div
            key={h}
            style={{
              flex: 1, textAlign: "center", fontSize: 6, minWidth: 0,
              color: h === hour ? "#334155" : "#94a3b8",
              fontWeight: h === hour ? 700 : undefined,
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {/* Current-hour dot */}
      <div style={{ display: "flex", gap: 2, marginTop: 1 }}>
        {hours.map((h) =>
          h === hour ? (
            <div key={h} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#f59e0b", boxShadow: "0 0 4px rgba(245,158,11,0.7)",
              }} />
            </div>
          ) : (
            <div key={h} style={{ flex: 1, minWidth: 0 }} />
          ),
        )}
      </div>
    </div>
  );
}

interface VenueCardProps {
  venue: any;
  hour: number;
  dateKey: string;
  getStatus: (v: any, dk: string, h: number) => string | undefined;
  getSunHours: (v: any, dk: string) => number;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function VenueCard({
  venue, hour, dateKey, getStatus, getSunHours, isExpanded, onToggle, onSelect,
}: VenueCardProps) {
  const [photo, setPhoto] = useState<string | null | undefined>(
    photoCache.has(venue.id) ? photoCache.get(venue.id) : undefined,
  );
  const [hoursData, setHoursData] = useState<any>(
    hoursCache.has(venue.id) ? hoursCache.get(venue.id) : undefined,
  );
  const hasFetched = useRef(photoCache.has(venue.id));

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    const params = new URLSearchParams({
      id: venue.id, name: venue.name,
      lat: String(venue.lat), lng: String(venue.lng), type: venue.type,
    });
    fetch(`/api/venue-photo?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { const url = d?.photoUrl ?? null; photoCache.set(venue.id, url); setPhoto(url); })
      .catch(() => { photoCache.set(venue.id, null); setPhoto(null); });
    fetch(`/api/venue-hours?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { hoursCache.set(venue.id, d); setHoursData(d); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = hoursData?.openNow;
  const openText = isOpen === true
    ? `Öppet${hoursData.closesAt ? ` — stänger ${hoursData.closesAt}` : ""}`
    : isOpen === false ? buildClosedStatus(hoursData?.week) : null;

  const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
  const todayMon0 = (new Date().getDay() + 6) % 7;
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}&travelmode=walking`;

  return (
    <div style={{
      borderRadius: 10,
      background: isExpanded ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.45)",
      border: `0.5px solid ${isExpanded ? "rgba(251,146,60,0.4)" : "rgba(255,255,255,0.7)"}`,
      marginBottom: 6,
      overflow: "hidden",
      transition: "background 0.18s ease",
    }}>

      {/* Photo — full width at top. Shimmer while loading, hidden if no photo. */}
      <div style={{
        height: photo === null ? 0 : 60,
        overflow: "hidden",
        background: "linear-gradient(180deg,#f1f5f9,#e2e8f0)",
        transition: "height 0.2s ease",
        borderRadius: "11px 11px 0 0",
      }}>
        {typeof photo === "string" && (
          <img
            src={photo}
            alt={venue.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </div>

      {/* Clickable collapsed content */}
      <div
        style={{ padding: "6px 8px", cursor: "pointer" }}
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name — no status dot */}
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#0f172a",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {venue.name}
            </div>
            {/* Rating + type */}
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
              {venue.rating != null && <span>⭐ {venue.rating.toFixed(1)} · </span>}
              {typeLabel(venue.type)}
              {venue.rooftop && <span style={{ color: "#f59e0b" }}> · ↑ Takbar</span>}
            </div>
            {/* Hours — visible when minimized */}
            {openText && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: isOpen ? "#10b981" : "#ef4444",
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 500,
                  color: isOpen ? "#059669" : "#dc2626",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {openText}
                </span>
              </div>
            )}
          </div>

          {/* Expand chevron */}
          <svg
            width="11" height="11" viewBox="0 0 12 12" fill="none"
            stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round"
            style={{
              marginTop: 2, flexShrink: 0,
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </div>

        {/* Sun diagram — always visible */}
        <SunDiagram
          venue={venue} dateKey={dateKey} hour={hour} getStatus={getStatus}
        />
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div style={{ padding: "0 8px 8px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {/* Full week hours */}
          {hoursData?.week && hoursData.week.length > 0 && (
            <div style={{
              background: "rgba(248,250,252,0.9)", borderRadius: 8,
              padding: "6px 8px", fontSize: 10, color: "#475569", marginTop: 10,
            }}>
              {hoursData.week.map((segs: any[], i: number) => {
                const isToday = i === todayMon0;
                const timeText = segs.length
                  ? segs.map((s: any) => `${s.open}–${s.close}`).join(", ")
                  : "Stängt";
                return (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between",
                    gap: 8, padding: "2px 0",
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? "#0f172a" : "#64748b",
                  }}>
                    <span>{DAYS[i]}</span>
                    <span>{timeText}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              style={{
                flex: 1, height: 32,
                border: "1px solid rgba(251,146,60,0.5)", borderRadius: 8,
                background: "linear-gradient(135deg,rgba(251,146,60,0.15),rgba(245,158,11,0.08))",
                color: "#c2410c", fontSize: 11, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Visa på kartan
            </button>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8,
                background: "#fff", display: "flex", alignItems: "center",
                justifyContent: "center", textDecoration: "none", flexShrink: 0,
              }}
              title="Öppna i Google Maps"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
                <circle cx="12" cy="9" r="2.5" fill="#fff" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export interface AreaSearchPanelProps {
  /** Sheet visibility. When false the panel slides off-screen with animation. */
  open: boolean;
  venues: any[];
  hour: number;
  dateKey: string;
  onClose: () => void;
  onSelectVenue: (venue: any) => void;
  getStatus: (v: any, dk: string, h: number) => string | undefined;
  getSunHours: (v: any, dk: string) => number;
  /** When set, switches the panel to "nearby mode" — shows distance sort and adjusted title. */
  userLocation?: { lat: number; lng: number } | null;
}

export default function AreaSearchPanel({
  open, venues, hour, dateKey, onClose, onSelectVenue, getStatus, getSunHours, userLocation,
}: AreaSearchPanelProps) {
  // Inline backdrop-filter på header — globalt `* { backdrop-filter: none
  // !important }` strippar annars all blur från alla element. setProperty
  // med !important via JS slår den regeln (inline +
  // !important > extern + !important på samma specificitet).
  const headerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    el.style.setProperty("backdrop-filter", "blur(48px) saturate(1.8)", "important");
    el.style.setProperty("-webkit-backdrop-filter", "blur(48px) saturate(1.8)", "important");
  }, [open]);

  // Multi-select sort. Each enabled criterion contributes its rank in the
  // single-sort order; the combined order is the sum of ranks (lowest =
  // best on all selected axes). At least one must stay on — toggling the
  // last selected criterion is a no-op so the list never enters an
  // undefined state.
  const [sortKeys, setSortKeys] = useState<Set<SortMode>>(() =>
    new Set<SortMode>(userLocation ? ["distance"] : ["sun-remaining"]),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(40);

  useEffect(() => { setDisplayCount(40); }, [venues]);

  // Reset sort when switching between nearby and area mode
  const prevNearby = useRef<boolean>(!!userLocation);
  useEffect(() => {
    const isNearby = !!userLocation;
    if (isNearby !== prevNearby.current) {
      prevNearby.current = isNearby;
      setSortKeys(new Set([isNearby ? "distance" : "sun-remaining"]));
    }
  }, [userLocation]);

  function toggleSort(key: SortMode) {
    setSortKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const sorted = useMemo(() => {
    const getMetric = (v: any, key: SortMode): number => {
      if (key === "sun-remaining") return countSunHoursFrom(v, dateKey, hour, getStatus);
      if (key === "rating") return v.rating ?? -1;
      if (key === "distance" && userLocation) {
        const cosLat = Math.cos(userLocation.lat * Math.PI / 180);
        const dlat = (v.lat - userLocation.lat) * 111_000;
        const dlng = (v.lng - userLocation.lng) * 111_000 * cosLat;
        return -(dlat * dlat + dlng * dlng); // closer = higher metric = sorted first
      }
      return getSunHours(v, dateKey);
    };

    const keys = Array.from(sortKeys);
    if (keys.length === 1) {
      const k = keys[0];
      return [...venues].sort((a, b) => getMetric(b, k) - getMetric(a, k));
    }

    // Multi-criteria: rank-sum. For each key, sort venues descending by
    // that metric and assign rank = position. Sum ranks per venue, then
    // sort by the sum ascending (best combined rank first).
    const rankSum = new Map<string, number>();
    for (const k of keys) {
      const byK = [...venues].sort((a, b) => getMetric(b, k) - getMetric(a, k));
      byK.forEach((v, idx) => {
        rankSum.set(v.id, (rankSum.get(v.id) ?? 0) + idx);
      });
    }
    return [...venues].sort(
      (a, b) => (rankSum.get(a.id) ?? 0) - (rankSum.get(b.id) ?? 0),
    );
  }, [venues, sortKeys, hour, dateKey]);

  const displayed = sorted.slice(0, displayCount);

  const sortBtn = (key: SortMode, label: string) => {
    const isActive = sortKeys.has(key);
    return (
      <button
        key={key}
        onClick={() => toggleSort(key)}
        aria-pressed={isActive}
        style={{
          flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600,
          borderRadius: 8, cursor: "pointer",
          border: isActive ? "1px solid rgba(251,146,60,0.65)" : "0.5px solid rgba(255,255,255,0.55)",
          background: isActive
            ? "linear-gradient(135deg,rgba(251,146,60,0.22),rgba(245,158,11,0.1))"
            : "rgba(255,255,255,0.3)",
          color: isActive ? "#c2410c" : "#475569",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "all 0.15s ease",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      peekHeight={460}
      desktopWidth={300}
      className="area-search-sheet"
      expandOnScroll
    >
      {/* Sticky header — title + close + sort. Stays put while the list
          below scrolls so the user can re-sort without scrolling back up.
          Tung blur sätts inline via useLayoutEffect ovan så den inte
          strippas av det globala backdrop-filter-undantaget. */}
      <div ref={headerRef} className="area-search-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              {userLocation ? "Nära dig" : "I detta område"}
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
              {venues.length} {venues.length === 1 ? "ställe" : "ställen"}
              {userLocation ? " inom 200m" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30,
              border: "0.5px solid rgba(255,255,255,0.55)", borderRadius: 10,
              background: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#475569", flexShrink: 0,
            }}
            title="Stäng"
            aria-label="Stäng"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {userLocation && sortBtn("distance", "Närmaste")}
          {sortBtn("sun-remaining", "Sol kvar")}
          {sortBtn("rating", "Betyg")}
          {sortBtn("sun-count", "Mest sol")}
        </div>
      </div>

      {/* Venue list */}
      <div className="area-search-list">
        {displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div
              style={{
                width: 52, height: 52, margin: "0 auto 10px",
                borderRadius: "50%",
                background: "linear-gradient(160deg, rgba(241,245,249,0.9), rgba(226,232,240,0.7))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, lineHeight: 1,
              }}
              aria-hidden
            >🗺️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 3 }}>
              Inga ställen här
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, maxWidth: 240, margin: "0 auto" }}>
              {userLocation
                ? "Inga uteserveringar med sol inom 200m just nu — prova en annan timme."
                : "Pannar du utåt på kartan och söker igen hittar du fler — eller släpp filtren ovan."}
            </div>
          </div>
        ) : (
          <>
            {displayed.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                hour={hour}
                dateKey={dateKey}
                getStatus={getStatus}
                getSunHours={getSunHours}
                isExpanded={expandedId === venue.id}
                onToggle={() => setExpandedId(expandedId === venue.id ? null : venue.id)}
                onSelect={() => onSelectVenue(venue)}
              />
            ))}
            {sorted.length > displayCount && (
              <button
                onClick={() => setDisplayCount((c) => c + 40)}
                style={{
                  width: "100%", padding: "10px",
                  border: "0.5px solid rgba(255,255,255,0.55)", borderRadius: 10,
                  background: "rgba(255,255,255,0.4)", cursor: "pointer",
                  fontSize: 12, color: "#475569", fontWeight: 500,
                }}
              >
                Visa fler ({sorted.length - displayCount} kvar)
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
