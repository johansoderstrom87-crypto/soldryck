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

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export default function AdminClaimsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueSummary[]>([]);
  const [claims, setClaims] = useState<Record<string, ClaimedVenueData>>({});
  const [selected, setSelected] = useState<VenueSummary | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadClaims = useCallback(async () => {
    const res = await fetch("/api/admin/claims");
    if (!res.ok) return;
    const data = await res.json();
    setClaims(data.venues ?? {});
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-800">
          Soldryck Admin — Claims
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Hantera verifierade ställen och happy hour-tider.
        </p>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Sök venue (namn eller OSM-ID)
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="t.ex. Tudor Arms eller 29898135"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
          {results.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => selectVenue(v)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-amber-50 ${
                      selected?.id === v.id ? "bg-amber-50" : ""
                    }`}
                  >
                    <span>
                      <span className="font-medium text-slate-800">{v.name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {v.type} · {v.id}
                      </span>
                    </span>
                    {claims[v.id] && (
                      <span className="text-xs text-green-600">✓ verifierad</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected && (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium text-slate-800">
                {selected.name}
              </h2>
              <span className="text-xs text-slate-400">ID: {selected.id}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Verifierad datum">
                <input
                  type="date"
                  value={form.verifiedAt}
                  onChange={(e) =>
                    setForm({ ...form, verifiedAt: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Ägarens email">
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) =>
                    setForm({ ...form, ownerEmail: e.target.value })
                  }
                  className={inputCls}
                  placeholder="namn@restaurang.se"
                />
              </Field>
            </div>

            <Field label="Anteckningar (intern)" className="mt-3">
              <textarea
                value={form.ownerNotes}
                onChange={(e) =>
                  setForm({ ...form, ownerNotes: e.target.value })
                }
                className={`${inputCls} h-20 resize-none`}
                placeholder="t.ex. ringt och bekräftat 2026-05-15"
              />
            </Field>

            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <input
                  type="checkbox"
                  checked={form.happyHourEnabled}
                  onChange={(e) =>
                    setForm({ ...form, happyHourEnabled: e.target.checked })
                  }
                />
                Happy Hour
              </label>

              {form.happyHourEnabled && (
                <div className="mt-3 grid grid-cols-4 gap-3">
                  <Field label="Dagar">
                    <input
                      type="text"
                      value={form.daysLabel}
                      onChange={(e) =>
                        setForm({ ...form, daysLabel: e.target.value })
                      }
                      className={inputCls}
                      placeholder="mån–fre"
                    />
                  </Field>
                  <Field label="Från (kl)">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={form.start}
                      onChange={(e) =>
                        setForm({ ...form, start: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Till (kl)">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={form.end}
                      onChange={(e) =>
                        setForm({ ...form, end: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Beskrivning" className="col-span-4">
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className={inputCls}
                      placeholder="t.ex. Halvpris på öl och husvin"
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? "Sparar…" : "Spara"}
              </button>
              {claims[selected.id] && (
                <button
                  onClick={remove}
                  disabled={saving}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Ta bort
                </button>
              )}
              {status && (
                <span
                  className={`text-sm ${
                    status.startsWith("Fel") ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-800">
            Verifierade ställen ({claimedEntries.length})
          </h2>
          {claimedEntries.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              Inga ställen verifierade än.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {claimedEntries.map(([id, data]) => (
                <li key={id}>
                  <button
                    onClick={() => selectClaimedById(id)}
                    className="flex w-full items-center justify-between px-1 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-mono text-xs text-slate-500">
                        {id}
                      </span>
                      {data.happyHour && (
                        <span className="ml-3 text-xs text-amber-700">
                          HH {data.happyHour.start}–{data.happyHour.end},{" "}
                          {data.happyHour.daysLabel}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">
                      {data.verifiedAt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
