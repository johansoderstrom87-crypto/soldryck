"use client";

import { useEffect, useState, useCallback } from "react";

interface VenueSummary {
  id: string;
  name: string;
  type: string;
  address: string;
}

interface HappyHour {
  daysLabel: string;
  start: number;
  end: number;
  description: string;
}

interface ClaimedVenueData {
  verifiedAt: string;
  ownerEmail?: string;
  ownerNotes?: string;
  happyHour?: HappyHour;
}

interface FormState {
  verifiedAt: string;
  ownerEmail: string;
  ownerNotes: string;
  happyHourEnabled: boolean;
  daysLabel: string;
  start: string;
  end: string;
  description: string;
}

function emptyForm(): FormState {
  return {
    verifiedAt: new Date().toISOString().slice(0, 10),
    ownerEmail: "",
    ownerNotes: "",
    happyHourEnabled: false,
    daysLabel: "mån–fre",
    start: "16",
    end: "18",
    description: "",
  };
}

function fromClaim(d: ClaimedVenueData): FormState {
  return {
    verifiedAt: d.verifiedAt,
    ownerEmail: d.ownerEmail ?? "",
    ownerNotes: d.ownerNotes ?? "",
    happyHourEnabled: Boolean(d.happyHour),
    daysLabel: d.happyHour?.daysLabel ?? "mån–fre",
    start: String(d.happyHour?.start ?? 16),
    end: String(d.happyHour?.end ?? 18),
    description: d.happyHour?.description ?? "",
  };
}

function toClaim(f: FormState): ClaimedVenueData {
  const out: ClaimedVenueData = { verifiedAt: f.verifiedAt };
  if (f.ownerEmail.trim()) out.ownerEmail = f.ownerEmail.trim();
  if (f.ownerNotes.trim()) out.ownerNotes = f.ownerNotes.trim();
  if (f.happyHourEnabled) {
    out.happyHour = {
      daysLabel: f.daysLabel.trim(),
      start: Number(f.start),
      end: Number(f.end),
      description: f.description.trim(),
    };
  }
  return out;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  fontSize: 13,
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#0f172a",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
};

export default function ClaimsTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueSummary[]>([]);
  const [claims, setClaims] = useState<Record<string, ClaimedVenueData>>({});
  const [selected, setSelected] = useState<VenueSummary | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/claims");
      if (res.status === 401) throw new Error("Ej autentiserad");
      if (!res.ok) throw new Error("Serverfel");
      const data = await res.json();
      setClaims(data.venues ?? {});
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/venues?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.venues ?? []);
      } catch {}
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const selectVenue = (v: VenueSummary) => {
    setSelected(v);
    setStatus("");
    const existing = claims[v.id];
    setForm(existing ? fromClaim(existing) : emptyForm());
  };

  const selectClaimedById = async (id: string) => {
    setStatus("");
    const existing = claims[id];
    if (!existing) return;
    let venue: VenueSummary | null = null;
    try {
      const res = await fetch(`/api/admin/venues?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        venue = data.venue ?? null;
      }
    } catch {}
    setSelected(venue ?? { id, name: `Venue ${id}`, type: "", address: "" });
    setForm(fromClaim(existing));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch(
        `/api/admin/claims?id=${encodeURIComponent(selected.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toClaim(form)),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setStatus(`Fel: ${err.error}`);
        return;
      }
      setStatus("Sparat ✓");
      await loadClaims();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm(`Ta bort verifiering för ${selected.name}?`)) return;
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch(
        `/api/admin/claims?id=${encodeURIComponent(selected.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setStatus(`Fel: ${err.error}`);
        return;
      }
      setStatus("Borttaget ✓");
      setSelected(null);
      setForm(emptyForm());
      await loadClaims();
    } finally {
      setSaving(false);
    }
  };

  const claimedEntries = Object.entries(claims).sort(([, a], [, b]) =>
    (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? ""),
  );

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
      {/* Search */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <label style={labelStyle}>Sök venue (namn eller OSM-ID)</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="t.ex. Tudor Arms eller 29898135"
          style={inputStyle}
        />
        {results.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            {results.map((v) => (
              <li key={v.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <button
                  onClick={() => selectVenue(v)}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    fontSize: 13,
                    background: selected?.id === v.id ? "#fffbeb" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{v.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#94a3b8" }}>{v.type} · {v.id}</span>
                  </span>
                  {claims[v.id] && (
                    <span style={{ fontSize: 11, color: "#059669" }}>✓ verifierad</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit form */}
      {selected && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: 0 }}>{selected.name}</h2>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>ID: {selected.id}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Verifierad datum</label>
              <input
                type="date"
                value={form.verifiedAt}
                onChange={(e) => setForm({ ...form, verifiedAt: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Ägarens email</label>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                placeholder="namn@restaurang.se"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Anteckningar (intern)</label>
            <textarea
              value={form.ownerNotes}
              onChange={(e) => setForm({ ...form, ownerNotes: e.target.value })}
              placeholder="t.ex. ringt och bekräftat 2026-05-15"
              style={{ ...inputStyle, height: 60, resize: "none", fontFamily: "inherit" }}
            />
          </div>

          {/* Happy Hour */}
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#92400e", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.happyHourEnabled}
                onChange={(e) => setForm({ ...form, happyHourEnabled: e.target.checked })}
              />
              Happy Hour
            </label>

            {form.happyHourEnabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <label style={labelStyle}>Dagar</label>
                  <input
                    type="text"
                    value={form.daysLabel}
                    onChange={(e) => setForm({ ...form, daysLabel: e.target.value })}
                    placeholder="mån–fre"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Från (kl)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Till (kl)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Beskrivning</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="t.ex. Halvpris på öl och husvin"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "#f59e0b",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Sparar…" : "Spara"}
            </button>
            {claims[selected.id] && (
              <button
                onClick={remove}
                disabled={saving}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fff",
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Ta bort
              </button>
            )}
            {status && (
              <span style={{ fontSize: 12, color: status.startsWith("Fel") ? "#b91c1c" : "#059669" }}>{status}</span>
            )}
          </div>
        </div>
      )}

      {/* Existing claims list */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: "0 0 10px" }}>
          Verifierade ställen ({claimedEntries.length})
        </h3>
        {claimedEntries.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Inga ställen verifierade än.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {claimedEntries.map(([id, data]) => (
              <li key={id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <button
                  onClick={() => selectClaimedById(id)}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 4px",
                    fontSize: 13,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, color: "#64748b" }}>{id}</span>
                    {data.happyHour && (
                      <span style={{ marginLeft: 12, fontSize: 11, color: "#b45309" }}>
                        HH {data.happyHour.start}–{data.happyHour.end}, {data.happyHour.daysLabel}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{data.verifiedAt}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
