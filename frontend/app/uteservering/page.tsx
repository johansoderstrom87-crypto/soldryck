import type { Metadata } from "next";
import Link from "next/link";
import { getAllVenues } from "../lib/venue-data";
import { venueSlug } from "../lib/slug";
import type { ComputedVenue } from "../data/venues-computed";

const SITE_URL = "https://soldryck.se";

export const metadata: Metadata = {
  title: "Alla uteserveringar i Stockholm med sol-data | Soldryck",
  description:
    "Komplett lista över de ~2 843 uteserveringar i Stockholm som Soldryck har solberäkningar för. Restauranger, caféer, barer och takbarer — sorterade efter typ.",
  alternates: {
    canonical: `${SITE_URL}/uteservering`,
  },
};

const TYPE_GROUPS: Array<{ key: string; label: string; match: (v: ComputedVenue) => boolean }> = [
  { key: "takbar", label: "Takbarer", match: (v) => !!v.rooftop },
  {
    key: "restaurang",
    label: "Restauranger",
    match: (v) => !v.rooftop && (v.type === "restaurant" || v.type === "food_court"),
  },
  {
    key: "cafe",
    label: "Caféer & glassbarer",
    match: (v) => !v.rooftop && (v.type === "cafe" || v.type === "ice_cream"),
  },
  {
    key: "bar",
    label: "Barer & pubar",
    match: (v) =>
      !v.rooftop && (v.type === "bar" || v.type === "pub" || v.type === "biergarten"),
  },
  {
    key: "snabbmat",
    label: "Snabbmat",
    match: (v) => !v.rooftop && v.type === "fast_food",
  },
];

function svCollator() {
  return new Intl.Collator("sv-SE", { sensitivity: "base" });
}

export default function VenueIndexPage() {
  const venues = getAllVenues();
  const collator = svCollator();
  const groups = TYPE_GROUPS.map((g) => ({
    ...g,
    venues: venues
      .filter(g.match)
      .sort((a, b) => collator.compare(a.name, b.name)),
  })).filter((g) => g.venues.length > 0);

  const totalCount = groups.reduce((sum, g) => sum + g.venues.length, 0);

  return (
    <main
      style={{
        minHeight: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "linear-gradient(180deg, #fff7ed 0%, #fffbeb 280px, #fff 600px)",
      }}
    >
      <article
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding:
            "calc(28px + var(--safe-top, 0px)) 22px calc(40px + var(--safe-bottom, 0px))",
          fontFamily: "var(--font-outfit), var(--font-inter), system-ui, sans-serif",
          color: "#0f172a",
          lineHeight: 1.55,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#64748b",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Tillbaka till kartan
        </Link>

        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Alla uteserveringar i Stockholm
          </h1>
          <p style={{ marginTop: 8, color: "#64748b", fontSize: 14 }}>
            {totalCount.toLocaleString("sv-SE")} ställen med soldata — sorterade efter typ.
            Klicka på ett ställe för sol-statistik per månad, bästa timme och praktisk info.
          </p>
        </header>

        {groups.map((g) => (
          <section key={g.key} style={{ marginBottom: 36 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 12px 0",
                borderBottom: "2px solid #fde68a",
                paddingBottom: 6,
              }}
            >
              {g.label}{" "}
              <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>
                ({g.venues.length.toLocaleString("sv-SE")})
              </span>
            </h2>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "4px 18px",
              }}
            >
              {g.venues.map((v) => (
                <li key={v.id} style={{ fontSize: 14 }}>
                  <Link
                    href={`/uteservering/${venueSlug(v)}`}
                    style={{
                      color: "#1e293b",
                      textDecoration: "none",
                      display: "block",
                      padding: "3px 0",
                    }}
                  >
                    {v.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer
          style={{
            fontSize: 12,
            color: "#94a3b8",
            borderTop: "1px solid #e2e8f0",
            paddingTop: 16,
            marginTop: 16,
          }}
        >
          <p style={{ margin: 0 }}>
            Soldryck täcker uteserveringar i Stockholms kommun samt närliggande förorter
            (Solna, Sundbyberg, Lidingö m.fl.). Soldata uppdateras ungefär en gång per år.
          </p>
        </footer>
      </article>
    </main>
  );
}
