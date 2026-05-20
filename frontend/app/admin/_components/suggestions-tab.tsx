"use client";

import { useEffect, useState, useCallback } from "react";

interface Suggestion {
  id: number;
  message: string;
  status: "new" | "liked";
  created_at: string;
}

export default function SuggestionsTab() {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [innerTab, setInnerTab] = useState<"new" | "liked">("new");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/suggestions`);
      if (res.status === 401) throw new Error("Ej autentiserad");
      if (!res.ok) throw new Error("Serverfel");
      const data = await res.json();
      setRows(data);
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: number, status: "new" | "liked") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/suggestions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Kunde inte uppdatera");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (id: number) => {
    if (!confirm("Kasta detta förslag?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/suggestions?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte ta bort");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = rows.filter((r) => r.status === innerTab);
  const newCount = rows.filter((r) => r.status === "new").length;
  const likedCount = rows.filter((r) => r.status === "liked").length;

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
      {/* Inner tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([
          { v: "new" as const, label: "Nya", count: newCount },
          { v: "liked" as const, label: "Att göra", count: likedCount },
        ]).map((t) => (
          <button
            key={t.v}
            onClick={() => setInnerTab(t.v)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              background: innerTab === t.v ? "#0f172a" : "#fff",
              color: innerTab === t.v ? "#fff" : "#64748b",
              borderColor: innerTab === t.v ? "#0f172a" : "#e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11,
              padding: "1px 7px",
              borderRadius: 10,
              background: innerTab === t.v ? "rgba(255,255,255,0.2)" : "#f1f5f9",
              color: innerTab === t.v ? "#fff" : "#64748b",
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          {innerTab === "new" ? "Inga nya förslag." : "Inga gillade förslag ännu."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((row) => (
            <div
              key={row.id}
              style={{
                background: "#fff",
                border: `1px solid ${row.status === "liked" ? "#fde68a" : "#e2e8f0"}`,
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 }}>
                <div style={{ fontSize: 14, color: "#0f172a", whiteSpace: "pre-wrap", lineHeight: 1.5, flex: 1 }}>
                  {row.message}
                </div>
                <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {new Date(row.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {innerTab === "new" ? (
                  <button
                    onClick={() => updateStatus(row.id, "liked")}
                    disabled={busyId === row.id}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 8,
                      border: "1px solid #f59e0b",
                      background: "#f59e0b",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: busyId === row.id ? "wait" : "pointer",
                    }}
                  >
                    Gilla → att göra
                  </button>
                ) : (
                  <button
                    onClick={() => updateStatus(row.id, "new")}
                    disabled={busyId === row.id}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#475569",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: busyId === row.id ? "wait" : "pointer",
                    }}
                  >
                    ← Tillbaka till nya
                  </button>
                )}
                <button
                  onClick={() => discard(row.id)}
                  disabled={busyId === row.id}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 8,
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: busyId === row.id ? "wait" : "pointer",
                  }}
                >
                  Kasta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
