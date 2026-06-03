"use client";

import { useEffect, useState } from "react";

// Allmän "berätta vad du tycker"-knapp. Flyter i övre högra hörnet (speglar
// menyknappen i övre vänstra) och skickar fri text till samma backend som
// menyns "Kom med förslag" — /api/suggestions — så all feedback landar i
// admin-fliken "Förslag". Medvetet okategoriserad: en enkel textruta räcker
// så länge sajten är ny och vi mest vill ha helhetsintryck.
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Escape stänger modalen (men inte mitt i en sändning — då vet användaren
  // inte om det gick fram).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state !== "sending") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, state]);

  async function submit() {
    const message = text.trim();
    if (!message || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed");
      setState("sent");
      setText("");
      setTimeout(() => { setOpen(false); setState("idle"); }, 1200);
    } catch {
      setState("error");
    }
  }

  return (
    <>
      {/* Flytande pill — övre högra hörnet, speglar menyknappen. Glas-stil
          enligt resten av appen (vit halvtransparent + blur + varm skugga). */}
      <button
        onClick={() => { setOpen(true); setState("idle"); }}
        aria-label="Berätta vad du tycker"
        className="absolute flex items-center gap-1.5 transition-all active:scale-95"
        style={{
          top: "calc(var(--safe-top, 0px) + 20px)",
          right: "calc(var(--safe-right, 0px) + 12px)",
          zIndex: 1200,
          height: 44,
          paddingLeft: 14,
          paddingRight: 16,
          borderRadius: 9999,
          background: "rgba(255,255,255,0.55)",
          border: "0.5px solid rgba(255,255,255,0.7)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          boxShadow: "0 6px 20px rgba(245,158,11,0.18), 0 2px 6px rgba(0,0,0,0.08)",
          color: "#0f172a",
          fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
        }}
        title="Berätta vad du tycker"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Tyck till
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Berätta vad du tycker"
          className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={() => { if (state !== "sending") setOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base font-semibold text-slate-800">Berätta vad du tycker</h2>
              <button
                onClick={() => { if (state !== "sending") setOpen(false); }}
                className="text-slate-400 hover:text-slate-600 -mt-1 -mr-1 p-1"
                aria-label="Stäng"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Soldryck är helt nytt och fortfarande på experimentstadiet. Vad gillar du, vad strular, vad saknas? All feedback hjälper.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Vad tycker du om sidan?"
              autoFocus
              rows={5}
              maxLength={2000}
              disabled={state === "sending" || state === "sent"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none disabled:bg-slate-50"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                {state === "error" && "Kunde inte skicka. Försök igen."}
                {state === "sent" && "Tack! Din feedback är skickad ✓"}
              </span>
              <button
                onClick={submit}
                disabled={!text.trim() || state === "sending" || state === "sent"}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state === "sending" ? "Skickar…" : state === "sent" ? "Skickat" : "Skicka in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
