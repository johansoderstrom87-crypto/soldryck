"use client";

import { useState } from "react";
import FeedbackTab from "./_components/feedback-tab";
import SuggestionsTab from "./_components/suggestions-tab";
import ClaimsTab from "./_components/claims-tab";
import StatsTab from "./_components/stats-tab";

type Tab = "stats" | "feedback" | "suggestions" | "claims";

const TABS: { id: Tab; label: string }[] = [
  { id: "stats", label: "Statistik" },
  { id: "feedback", label: "Rapporter" },
  { id: "suggestions", label: "Förslag" },
  { id: "claims", label: "Verifieringar" },
];

export default function AdminPage() {
  const [active, setActive] = useState<Tab>("stats");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>Soldryck — Admin</h1>
      </div>

      {/* Top-level tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e2e8f0", marginBottom: 20 }}>
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                marginBottom: -2,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#0f172a" : "#64748b",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active === "stats" && <StatsTab />}
      {active === "feedback" && <FeedbackTab />}
      {active === "suggestions" && <SuggestionsTab />}
      {active === "claims" && <ClaimsTab />}
    </div>
  );
}
