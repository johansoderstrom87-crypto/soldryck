"use client";

import { useState } from "react";

interface FeedbackModalProps {
  venue: {
    id: string;
    name: string;
    type: string;
    currentSchedule: Record<number, "sun" | "shade" | "night">;
    mode?: "schedule" | "seating";
  };
  onClose: () => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

function statusColor(s: "sun" | "shade" | "night" | null): string {
  if (s === "sun") return "#f59e0b";
  if (s === "shade") return "#cbd5e1";
  if (s === "night") return "#1e293b";
  return "#e2e8f0";
}

export default function FeedbackModal({ venue, onClose }: FeedbackModalProps) {
  const [schedule, setSchedule] = useState<Record<number, "sun" | "shade" | null>>(() => {
    const init: Record<number, "sun" | "shade" | null> = {};
    for (const h of HOURS) init[h] = null;
    return init;
  });
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const toggle = (h: number) => {
    setSchedule((prev) => {
      const current = prev[h];
      const next = current === null ? "sun" : current === "sun" ? "shade" : null;
      return { ...prev, [h]: next };
    });
  };

  const isSeating = venue.mode === "seating";
  const hasInput = isSeating ? comment.trim().length > 0 : Object.values(schedule).some((v) => v !== null);

  const submit = async () => {
    if (!hasInput) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venue.id,
          venueName: venue.name,
          type: isSeating ? "seating" : "schedule",
          schedule: isSeating ? {} : schedule,
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Något gick fel");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Kunde inte skicka");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm mx-auto p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">&#10003;</div>
            <div className="text-lg font-semibold text-slate-800 mb-1">Tack!</div>
            <div className="text-sm text-slate-500 mb-4">
              Din feedback har sparats och hjalper oss forbattra datan.
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium"
            >
              Stang
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-bold text-slate-900">{venue.name}</div>
                <div className="text-xs text-slate-400">
                  {isSeating ? "Bekräfta uteservering" : "Rapportera solförhållanden"}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
              >
                &#x2715;
              </button>
            </div>

            {isSeating ? (
              /* Seating confirmation mode */
              <div className="mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800 mb-3">
                  Vi har ingen bekräftad uteservering för detta ställe. Vet du om de har det?
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="t.ex. Ja, de har uteservering på framsidan! / Nej, inget utomhus."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 resize-none"
                  rows={3}
                  autoFocus
                />
              </div>
            ) : (
              <>
                {/* Current data (read-only) */}
                <div className="mb-4">
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">
                    Nuvarande data
                  </div>
                  <div className="flex gap-[2px]">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="flex-shrink-0 rounded-sm"
                        style={{
                          width: 14,
                          height: 14,
                          background: statusColor(venue.currentSchedule[h] ?? "shade"),
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-[2px] mt-0.5">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="text-[7px] text-slate-400 text-center flex-shrink-0"
                        style={{ width: 14 }}
                      >
                        {h}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable timeline */}
                <div className="mb-4">
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">
                    Tryck for att markera sol eller skugga
                  </div>
                  <div className="flex gap-[2px]">
                    {HOURS.map((h) => {
                      const val = schedule[h];
                      const bg =
                        val === "sun"
                          ? "#f59e0b"
                          : val === "shade"
                          ? "#cbd5e1"
                          : "#f1f5f9";
                      const border = val !== null ? "2px solid #0f172a" : "2px solid #e2e8f0";
                      return (
                        <button
                          key={h}
                          onClick={() => toggle(h)}
                          className="flex-shrink-0 rounded-sm transition-all active:scale-110"
                          style={{
                            width: 14,
                            height: 14,
                            background: bg,
                            border,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex gap-[2px] mt-0.5">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="text-[7px] text-slate-400 text-center flex-shrink-0"
                        style={{ width: 14 }}
                      >
                        {h}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#f59e0b" }} />
                      Sol
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#cbd5e1" }} />
                      Skugga
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }} />
                      Ej ifylld
                    </span>
                  </div>
                </div>

                {/* Comment */}
                <div className="mb-4">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Valfri kommentar..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 resize-none"
                    rows={2}
                  />
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="text-xs text-red-500 mb-3">{error}</div>
            )}

            {/* Submit */}
            <button
              onClick={submit}
              disabled={!hasInput || sending}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                hasInput && !sending
                  ? "bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
            >
              {sending ? "Skickar..." : isSeating ? "Skicka in" : "Skicka feedback"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
