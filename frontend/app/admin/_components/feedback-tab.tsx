"use client";

import { useEffect, useState } from "react";

interface FeedbackRow {
  id: number;
  venue_id: string;
  venue_name: string;
  type: string;
  schedule: Record<string, string | null>;
  comment: string | null;
  created_at: string;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

function ScheduleBar({ schedule }: { schedule: Record<string, string | null> }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {HOURS.map((h) => {
        const s = schedule[h];
        const bg = s === "sun" ? "#f59e0b" : s === "shade" ? "#94a3b8" : "#e2e8f0";
        return <div key={h} style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }} title={`${h}:00 — ${s ?? "–"}`} />;
      })}
    </div>
  );
}

export default function FeedbackTab() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "schedule" | "seating">("all");

  useEffect(() => {
    fetch(`/api/feedback`)
      .then((r) => {
        if (r.status === 401) throw new Error("Ej autentiserad");
        if (!r.ok) throw new Error("Serverfel");
        return r.json();
      })
      .then((data) => setRows(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.type === filter);
  const scheduleCount = rows.filter((r) => r.type === "schedule").length;
  const seatingCount = rows.filter((r) => r.type === "seating").length;

  if (loading) return <p style={{ color: "#64748b" }}>Laddar...</p>;
  if (error) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#991b1b", fontSize: 14 }}>
        {error}
      </div>
    );
  }

  return (
    <>
      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Totalt", count: rows.length, color: "#0f172a" },
          { label: "Solkorrigeringar", count: scheduleCount, color: "#d97706" },
          { label: "Uteservering-tips", count: seatingCount, color: "#059669" },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{count}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["all", "schedule", "seating"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              background: filter === f ? "#0f172a" : "#fff",
              color: filter === f ? "#fff" : "#64748b",
              borderColor: filter === f ? "#0f172a" : "#e2e8f0",
            }}
          >
            {f === "all" ? "Alla" : f === "schedule" ? "Solkorrigeringar" : "Uteservering-tips"}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Inga rapporter ännu.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((row) => (
            <div
              key={row.id}
              style={{
                background: "#fff",
                border: `1px solid ${row.type === "seating" ? "#d1fae5" : "#fde68a"}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{row.venue_name}</span>
                  <span style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "1px 7px",
                    borderRadius: 10,
                    background: row.type === "seating" ? "#d1fae5" : "#fef3c7",
                    color: row.type === "seating" ? "#065f46" : "#92400e",
                  }}>
                    {row.type === "seating" ? "Uteservering" : "Solkorrigering"}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {new Date(row.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>

              {row.type === "schedule" && Object.keys(row.schedule).length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <ScheduleBar schedule={row.schedule} />
                </div>
              )}

              {row.comment && (
                <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 6, padding: "6px 9px" }}>
                  {row.comment}
                </div>
              )}

              <div style={{ marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
                ID: {row.venue_id}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
