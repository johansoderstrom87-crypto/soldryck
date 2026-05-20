"use client";

import { useEffect, useState, useCallback } from "react";

interface Totals {
  total?: number;
  sessions?: number;
  page_views?: number;
  popup_opens?: number;
  bookings?: number;
  shares?: number;
  find_sun?: number;
  favorites_added?: number;
}

interface EventCount {
  name: string;
  n: number;
  sessions: number;
}

interface TopVenue {
  id: string;
  name: string;
  type: string;
  opens: number;
  uniqueSessions: number;
}

interface DailyPoint {
  day: string;
  sessions: number;
  pageViews: number;
  popupOpens: number;
}

interface StatsResponse {
  window: string;
  totals: Totals;
  eventCounts: EventCount[];
  topVenues: TopVenue[];
  daily: DailyPoint[];
}

const WINDOWS = [
  { days: 1, label: "Idag" },
  { days: 7, label: "7 dagar" },
  { days: 30, label: "30 dagar" },
  { days: 90, label: "90 dagar" },
];

const cardStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 14px",
  flex: 1,
  minWidth: 0,
};

const cardNumStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#0f172a",
  lineHeight: 1.1,
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  marginTop: 4,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  fontWeight: 500,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0f172a",
  margin: "0 0 10px",
};

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

function EventLabel(name: string): string {
  const labels: Record<string, string> = {
    page_view: "Sidvisningar",
    popup_opened: "Popup öppnad",
    book_clicked: "Bokning klickad",
    share_clicked: "Delning klickad",
    find_sun_clicked: "Hitta solen",
    gps_clicked: "GPS-knapp",
    favorite_added: "Favorit tillagd",
    favorite_removed: "Favorit borttagen",
    client_error: "JS-fel",
    unhandled_rejection: "JS-fel (promise)",
  };
  return labels[name] ?? name;
}

export default function StatsTab() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stats?days=${d}`);
      if (res.status === 401) throw new Error("Ej autentiserad");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Serverfel");
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  if (loading && !data) return <p style={{ color: "#64748b" }}>Laddar...</p>;
  if (error) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#991b1b", fontSize: 14 }}>
        {error}
      </div>
    );
  }
  if (!data) return null;

  const t = data.totals;
  const maxDailySessions = Math.max(1, ...data.daily.map((d) => d.sessions));
  const totalOpens = data.topVenues.reduce((sum, v) => sum + v.opens, 0);

  return (
    <>
      {/* Window picker */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setDays(w.days)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              background: days === w.days ? "#0f172a" : "#fff",
              color: days === w.days ? "#fff" : "#64748b",
              borderColor: days === w.days ? "#0f172a" : "#e2e8f0",
            }}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Top-line cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.sessions ?? 0}</div>
          <div style={cardLabelStyle}>Sessioner</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.page_views ?? 0}</div>
          <div style={cardLabelStyle}>Sidvisningar</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.popup_opens ?? 0}</div>
          <div style={cardLabelStyle}>Popup öppnade</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.bookings ?? 0}</div>
          <div style={cardLabelStyle}>Bokningar</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.find_sun ?? 0}</div>
          <div style={cardLabelStyle}>Hitta solen</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.shares ?? 0}</div>
          <div style={cardLabelStyle}>Delningar</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.favorites_added ?? 0}</div>
          <div style={cardLabelStyle}>Favoriter</div>
        </div>
        <div style={cardStyle}>
          <div style={cardNumStyle}>{t.total ?? 0}</div>
          <div style={cardLabelStyle}>Events totalt</div>
        </div>
      </div>

      {/* Daily bar chart */}
      {data.daily.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <h3 style={sectionTitle}>Sessioner per dag</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, marginTop: 8 }}>
            {data.daily.map((d) => {
              const h = Math.max(2, (d.sessions / maxDailySessions) * 110);
              return (
                <div
                  key={d.day}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}
                  title={`${formatDay(d.day)}: ${d.sessions} sessioner · ${d.pageViews} sidvisningar`}
                >
                  <div style={{ fontSize: 9, color: "#64748b" }}>{d.sessions}</div>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 32,
                      height: h,
                      background: "linear-gradient(180deg, #fbbf24, #f59e0b)",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <div style={{ fontSize: 9, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {formatDay(d.day)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top venues */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <h3 style={sectionTitle}>Mest klickade ställen ({data.topVenues.length})</h3>
        {data.topVenues.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Ingen aktivitet ännu.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.topVenues.map((v, i) => {
              const share = totalOpens > 0 ? (v.opens / data.topVenues[0].opens) * 100 : 0;
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8", width: 22, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.name}
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>{v.type}</span>
                    </div>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                      <div style={{ height: "100%", width: `${share}%`, background: "#f59e0b", borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, width: 50, textAlign: "right", flexShrink: 0 }}>
                    {v.opens}
                  </span>
                  <span style={{ fontSize: 10, color: "#94a3b8", width: 60, textAlign: "right", flexShrink: 0 }}>
                    {v.uniqueSessions} unika
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event breakdown */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <h3 style={sectionTitle}>Alla event-typer</h3>
        {data.eventCounts.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Inga event ännu.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>Event</th>
                <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>Antal</th>
                <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>Unika sessioner</th>
              </tr>
            </thead>
            <tbody>
              {data.eventCounts.map((e) => (
                <tr key={e.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 8px", color: "#0f172a" }}>{EventLabel(e.name)} <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{e.name}</span></td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{e.n}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748b" }}>{e.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
