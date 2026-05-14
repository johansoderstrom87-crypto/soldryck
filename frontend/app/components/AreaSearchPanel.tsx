"use client";

import { useState, useEffect, useRef, useMemo } from "react";

type NormalizedStatus = "sun" | "shade" | "partial" | "night";
type SortMode = "sun-remaining" | "rating" | "sun-count";

// Module-level caches so repeated opens don't re-fetch
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

function SunBars({
  venue, dateKey, hour, getStatus,
}: {
  venue: any;
  dateKey: string;
  hour: number;
  getStatus: (v: any, dk: string, h: number) => string | undefined;
}) {
  return (
    <div style={{ display: "flex", gap: 1.5, alignItems: "flex-end", height: 20 }}>
      {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => {
        const s = normalizeStatus(getStatus(venue, dateKey, h));
        const isCurrent = h === hour;
        let bg = "#e2e8f0";
        if (s === "sun") bg = isCurrent ? "#f59e0b" : "#fde68a";
        else if (s === "partial") bg = isCurrent ? "#fb923c" : "#fed7aa";
        else if (s === "night") bg = "#1e293b";
        return (
          <div
            key={h}
            style={{
              flex: 1,
              height: isCurrent ? 20 : 13,
              background: bg,
              borderRadius: 2,
              minWidth: 0,
              boxShadow:
                isCurrent && (s === "sun" || s === "partial")
                  ? "0 0 5px rgba(245,158,11,0.65)"
                  : undefined,
            }}
            title={`${h}:00`}
          />
        );
      })}
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

  // Fetch photo + hours on first expand
  useEffect(() => {
    if (!isExpanded || hasFetched.current) return;
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
  }, [isExpanded]);

  const status = normalizeStatus(getStatus(venue, dateKey, hour));
  const statusColor = {
    sun: "#f59e0b", partial: "#fb923c", shade: "#94a3b8", night: "#334155",
  }[status];
  const statusLabel = {
    sun: "Sol nu", partial: "Delvis sol", shade: "Skugga", night: "Natt",
  }[status];
  const sunHoursTotal = getSunHours(venue, dateKey);

  // Open/closed from fetched hours
  const isOpen = hoursData?.openNow;
  const openText = isOpen === true
    ? `Öppet${hoursData.closesAt ? ` — stänger ${hoursData.closesAt}` : ""}`
    : isOpen === false
    ? "Stängt"
    : null;

  // Full week hours for expanded view
  const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
  const todayMon0 = (new Date().getDay() + 6) % 7;

  const mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(venue.name)}/@${venue.lat},${venue.lng},17z`;

  return (
    <div
      style={{
        borderRadius: 12,
        background: isExpanded
          ? "rgba(255,255,255,0.82)"
          : "rgba(255,255,255,0.55)",
        border: `1px solid ${isExpanded ? "rgba(251,146,60,0.35)" : "rgba(255,255,255,0.7)"}`,
        marginBottom: 8,
        overflow: "hidden",
        transition: "background 0.18s ease, border-color 0.18s ease",
      }}
    >
      {/* Photo — only shown when expanded */}
      {isExpanded && photo && (
        <img
          src={photo}
          alt={venue.name}
          style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
        />
      )}
      {isExpanded && photo === undefined && (
        <div style={{
          width: "100%", height: 80,
          background: "linear-gradient(180deg,#f1f5f9,#e2e8f0)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}

      {/* Main clickable row */}
      <div
        style={{ padding: "10px 12px", cursor: "pointer" }}
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          {/* Status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: statusColor,
            marginTop: 5, flexShrink: 0,
            boxShadow: status === "sun" ? "0 0 6px rgba(245,158,11,0.55)" : undefined,
          }} />

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#0f172a",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {venue.name}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {venue.rating != null && (
                <span>⭐ {venue.rating.toFixed(1)}{venue.ratingCount != null && ` (${venue.ratingCount.toLocaleString("sv-SE")})`} · </span>
              )}
              {typeLabel(venue.type)}
              {venue.rooftop && <span style={{ marginLeft: 4, color: "#f59e0b", fontSize: 10 }}>↑ Takbar</span>}
            </div>
            {/* Status + sun info */}
            <div style={{ fontSize: 10, color: statusColor, marginTop: 2, fontWeight: 600 }}>
              {statusLabel} · {sunHoursTotal} soltimmar idag
            </div>
            {/* Sun diagram */}
            <div style={{ marginTop: 6 }}>
              <SunBars venue={venue} dateKey={dateKey} hour={hour} getStatus={getStatus} />
            </div>
          </div>

          {/* Expand chevron */}
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#94a3b8"
            strokeWidth="1.8" strokeLinecap="round"
            style={{
              marginTop: 4, flexShrink: 0,
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>

          {/* Opening hours */}
          {hoursData && (
            <div style={{ marginTop: 10 }}>
              {openText && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontSize: 11,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: isOpen ? "#10b981" : "#ef4444", flexShrink: 0,
                  }} />
                  <span style={{ color: isOpen ? "#059669" : "#dc2626", fontWeight: 500 }}>{openText}</span>
                </div>
              )}
              {hoursData.week && hoursData.week.length > 0 && (
                <div style={{
                  background: "rgba(248,250,252,0.8)", borderRadius: 8,
                  padding: "6px 8px", fontSize: 10, color: "#475569",
                }}>
                  {hoursData.week.map((segs: any[], i: number) => {
                    const isToday = i === todayMon0;
                    const timeText = segs.length
                      ? segs.map((s: any) => `${s.open}–${s.close}`).join(", ")
                      : "Stängt";
                    return (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", gap: 8,
                        padding: "2px 0",
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
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              style={{
                flex: 1, height: 32,
                border: "1px solid rgba(251,146,60,0.5)",
                borderRadius: 8,
                background: "linear-gradient(135deg, rgba(251,146,60,0.15), rgba(245,158,11,0.08))",
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
                width: 32, height: 32,
                border: "1px solid #e2e8f0", borderRadius: 8,
                background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                textDecoration: "none", flexShrink: 0,
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
  venues: any[];
  hour: number;
  dateKey: string;
  onClose: () => void;
  onSelectVenue: (venue: any) => void;
  getStatus: (v: any, dk: string, h: number) => string | undefined;
  getSunHours: (v: any, dk: string) => number;
}

export default function AreaSearchPanel({
  venues, hour, dateKey, onClose, onSelectVenue, getStatus, getSunHours,
}: AreaSearchPanelProps) {
  const [sort, setSort] = useState<SortMode>("sun-remaining");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(40);

  // Reset display count when venues list changes (map moved)
  useEffect(() => { setDisplayCount(40); }, [venues]);

  const sorted = useMemo(() => {
    return [...venues].sort((a, b) => {
      if (sort === "sun-remaining") {
        return (
          countSunHoursFrom(b, dateKey, hour, getStatus) -
          countSunHoursFrom(a, dateKey, hour, getStatus)
        );
      }
      if (sort === "rating") {
        return (b.rating ?? -1) - (a.rating ?? -1);
      }
      // sun-count: total sun hours today
      return getSunHours(b, dateKey) - getSunHours(a, dateKey);
    });
  }, [venues, sort, hour, dateKey]);

  const displayed = sorted.slice(0, displayCount);

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "min(360px, 100%)",
    zIndex: 1050,
    display: "flex",
    flexDirection: "column",
    background: "rgba(241,245,249,0.9)",
    backdropFilter: "blur(20px) saturate(1.4)",
    WebkitBackdropFilter: "blur(20px) saturate(1.4)",
    borderLeft: "0.5px solid rgba(255,255,255,0.65)",
    boxShadow: "-6px 0 32px rgba(0,0,0,0.12)",
    fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
  };

  const sortBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600,
    borderRadius: 8, cursor: "pointer",
    border: active ? "1px solid rgba(251,146,60,0.65)" : "1px solid rgba(0,0,0,0.08)",
    background: active
      ? "linear-gradient(135deg, rgba(251,146,60,0.22), rgba(245,158,11,0.1))"
      : "rgba(255,255,255,0.7)",
    color: active ? "#c2410c" : "#64748b",
    transition: "all 0.15s ease",
  });

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              Sök i detta område
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {venues.length} {venues.length === 1 ? "ställe" : "ställen"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, border: "none", borderRadius: 8,
              background: "rgba(0,0,0,0.07)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#475569",
            }}
            title="Stäng"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sort buttons */}
        <div style={{ display: "flex", gap: 5 }}>
          <button style={sortBtnStyle(sort === "sun-remaining")} onClick={() => setSort("sun-remaining")}>
            Sol kvar
          </button>
          <button style={sortBtnStyle(sort === "rating")} onClick={() => setSort("rating")}>
            Betyg
          </button>
          <button style={sortBtnStyle(sort === "sun-count")} onClick={() => setSort("sun-count")}>
            Mest sol
          </button>
        </div>
      </div>

      {/* Venue list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {displayed.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "#94a3b8", fontSize: 13,
          }}>
            Inga ställen i detta område
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
                  border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10,
                  background: "rgba(255,255,255,0.7)", cursor: "pointer",
                  fontSize: 12, color: "#64748b", fontWeight: 500,
                }}
              >
                Visa fler ({sorted.length - displayCount} kvar)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
