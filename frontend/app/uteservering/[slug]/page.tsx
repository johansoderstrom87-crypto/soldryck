import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findVenueBySlug } from "../../lib/venue-data";
import { venueSlug } from "../../lib/slug";
import type { ComputedVenue, SunStatus } from "../../data/venues-computed";

const SITE_URL = "https://soldryck.se";

const SWEDISH_MONTHS: Record<string, string> = {
  "04": "april",
  "05": "maj",
  "06": "juni",
  "07": "juli",
  "08": "augusti",
  "09": "september",
  "10": "oktober",
};

const TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurang",
  cafe: "Café",
  bar: "Bar",
  pub: "Pub",
  biergarten: "Ölträdgård",
  fast_food: "Snabbmat",
  ice_cream: "Glassbar",
  food_court: "Food court",
};

function typeLabel(venue: ComputedVenue): string {
  if (venue.rooftop) return "Takbar";
  return TYPE_LABEL[venue.type] ?? "Uteservering";
}

interface SunSummary {
  totalSun: number;
  totalDates: number;
  bestMonth: string | null;
  bestMonthSunPerDay: number;
  bestHour: number | null;
  monthlySunPerDay: Record<string, number>;
  firstSunHour: number | null;
  lastSunHour: number | null;
}

function computeSunSummary(venue: ComputedVenue): SunSummary {
  const dateKeys = Object.keys(venue.schedule);
  const monthlyDateCount: Record<string, number> = {};
  const monthlySun: Record<string, number> = {};
  const hourlySun: Record<number, number> = {};
  let totalSun = 0;
  let earliestSun: number | null = null;
  let latestSun: number | null = null;

  for (const dk of dateKeys) {
    const month = dk.substring(0, 2);
    monthlyDateCount[month] = (monthlyDateCount[month] ?? 0) + 1;
    const hours = venue.schedule[dk];
    for (const [h, s] of Object.entries(hours)) {
      if ((s as SunStatus) === "s") {
        const hourNum = Number(h);
        totalSun++;
        monthlySun[month] = (monthlySun[month] ?? 0) + 1;
        hourlySun[hourNum] = (hourlySun[hourNum] ?? 0) + 1;
        if (earliestSun === null || hourNum < earliestSun) earliestSun = hourNum;
        if (latestSun === null || hourNum > latestSun) latestSun = hourNum;
      }
    }
  }

  const monthlySunPerDay: Record<string, number> = {};
  for (const m of Object.keys(monthlySun)) {
    monthlySunPerDay[m] = monthlySun[m] / monthlyDateCount[m];
  }

  const bestMonthEntry = Object.entries(monthlySunPerDay).sort((a, b) => b[1] - a[1])[0];
  const bestHourEntry = Object.entries(hourlySun).sort((a, b) => b[1] - a[1])[0];

  return {
    totalSun,
    totalDates: dateKeys.length,
    bestMonth: bestMonthEntry?.[0] ?? null,
    bestMonthSunPerDay: bestMonthEntry?.[1] ?? 0,
    bestHour: bestHourEntry ? Number(bestHourEntry[0]) : null,
    monthlySunPerDay,
    firstSunHour: earliestSun,
    lastSunHour: latestSun,
  };
}

function venueToJsonLd(venue: ComputedVenue, summary: SunSummary): Record<string, unknown> {
  const schemaType =
    venue.type === "cafe" || venue.type === "ice_cream"
      ? "CafeOrCoffeeShop"
      : venue.type === "bar" || venue.type === "pub" || venue.type === "biergarten"
        ? "BarOrPub"
        : venue.type === "fast_food"
          ? "FastFoodRestaurant"
          : "Restaurant";

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: venue.name,
    url: `${SITE_URL}/uteservering/${venueSlug(venue)}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: venue.lat,
      longitude: venue.lng,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Stockholm",
      addressCountry: "SE",
      ...(venue.address && { streetAddress: venue.address }),
    },
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Uteservering", value: true },
      ...(venue.rooftop
        ? [{ "@type": "LocationFeatureSpecification", name: "Takbar", value: true }]
        : []),
      ...(venue.wheelchair === "yes"
        ? [{
            "@type": "LocationFeatureSpecification",
            name: "Tillgänglig för rullstol",
            value: true,
          }]
        : []),
      ...(venue.servesAlcohol
        ? [{ "@type": "LocationFeatureSpecification", name: "Serverar alkohol", value: true }]
        : []),
    ],
  };

  if (typeof venue.rating === "number" && venue.ratingCount && venue.ratingCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: venue.rating,
      ratingCount: venue.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (typeof venue.priceLevel === "number" && venue.priceLevel > 0) {
    jsonLd.priceRange = "$".repeat(Math.min(4, venue.priceLevel));
  }

  if (summary.bestHour !== null) {
    jsonLd.description =
      `${venue.name} har som mest sol kring kl ${summary.bestHour}:00. ` +
      `Bästa månaden för sol är ${SWEDISH_MONTHS[summary.bestMonth ?? ""] ?? ""}.`;
  }

  return jsonLd;
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = findVenueBySlug(slug);
  if (!venue) {
    return {
      title: "Hittades inte – Soldryck",
      robots: { index: false },
    };
  }
  const summary = computeSunSummary(venue);
  const label = typeLabel(venue);
  const bestMonth = summary.bestMonth ? SWEDISH_MONTHS[summary.bestMonth] : null;
  const description = bestMonth
    ? `${venue.name} – ${label.toLowerCase()} i Stockholm. Mest sol på uteserveringen i ${bestMonth} (ca ${summary.bestMonthSunPerDay.toFixed(1)} soltimmar/dag). Se timme-för-timme på Soldryck.`
    : `${venue.name} – ${label.toLowerCase()} i Stockholm. Se sol- och skuggdata för uteserveringen timme för timme på Soldryck.`;
  return {
    title: `${venue.name} – sol på uteserveringen | Soldryck`,
    description,
    alternates: {
      canonical: `${SITE_URL}/uteservering/${venueSlug(venue)}`,
    },
    openGraph: {
      type: "website",
      locale: "sv_SE",
      url: `${SITE_URL}/uteservering/${venueSlug(venue)}`,
      title: `${venue.name} – sol på uteserveringen`,
      description,
    },
  };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = findVenueBySlug(slug);
  if (!venue) notFound();

  const summary = computeSunSummary(venue);
  const label = typeLabel(venue);
  const bestMonthSv = summary.bestMonth ? SWEDISH_MONTHS[summary.bestMonth] : null;
  const sunPerDayAvg = summary.totalDates ? summary.totalSun / summary.totalDates : 0;

  const introParts: string[] = [];
  introParts.push(`${venue.name} är en ${label.toLowerCase()} i Stockholm`);
  if (venue.address) introParts.push(` på ${venue.address}`);
  introParts.push(".");
  if (sunPerDayAvg >= 6) {
    introParts.push(
      ` Uteserveringen är soldränkt — i snitt cirka ${sunPerDayAvg.toFixed(1)} soltimmar per dag under sommarsäsongen.`,
    );
  } else if (sunPerDayAvg >= 3) {
    introParts.push(
      ` Uteserveringen har sol delar av dagen — cirka ${sunPerDayAvg.toFixed(1)} soltimmar per typisk sommardag.`,
    );
  } else if (sunPerDayAvg > 0) {
    introParts.push(
      ` Uteserveringen ligger i huvudsakligen skuggat läge — cirka ${sunPerDayAvg.toFixed(1)} soltimmar per typisk sommardag.`,
    );
  } else {
    introParts.push(" Uteserveringen ligger helt i skugga enligt soldatan.");
  }
  if (bestMonthSv && summary.bestHour !== null) {
    introParts.push(
      ` Bästa månaden är ${bestMonthSv} och bästa soltimmen kring kl ${summary.bestHour}:00.`,
    );
  }
  const intro = introParts.join("");

  const factRows: Array<{ label: string; value: string }> = [];
  if (venue.address) factRows.push({ label: "Adress", value: venue.address });
  factRows.push({ label: "Typ", value: label });
  if (venue.rooftop) factRows.push({ label: "Takbar", value: "Ja" });
  if (venue.servesAlcohol) factRows.push({ label: "Serverar alkohol", value: "Ja" });
  if (venue.wheelchair === "yes") factRows.push({ label: "Tillgänglighet", value: "Rullstolsanpassad" });
  if (typeof venue.rating === "number" && venue.ratingCount) {
    factRows.push({
      label: "Betyg",
      value: `${venue.rating.toFixed(1)} / 5 (${venue.ratingCount.toLocaleString("sv-SE")} omdömen)`,
    });
  }
  if (typeof venue.priceLevel === "number" && venue.priceLevel > 0) {
    factRows.push({ label: "Prisnivå", value: "$".repeat(Math.min(4, venue.priceLevel)) });
  }

  const monthsSorted = Object.entries(summary.monthlySunPerDay).sort(([a], [b]) => a.localeCompare(b));

  const jsonLd = venueToJsonLd(venue, summary);

  return (
    <main
      style={{
        minHeight: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "linear-gradient(180deg, #fff7ed 0%, #fffbeb 280px, #fff 600px)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "calc(28px + var(--safe-top, 0px)) 22px calc(40px + var(--safe-bottom, 0px))",
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

        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {venue.name}
          </h1>
          <p style={{ marginTop: 6, color: "#64748b", fontSize: 14 }}>
            {label} på uteserveringen i Stockholm
          </p>
        </header>

        <p style={{ fontSize: 16, marginBottom: 24 }}>{intro}</p>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
            Sol i siffror
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <Stat label="Soltimmar/dag" value={`${sunPerDayAvg.toFixed(1)}`} />
            {bestMonthSv ? <Stat label="Bästa månad" value={bestMonthSv} /> : null}
            {summary.bestHour !== null ? (
              <Stat label="Bästa timme" value={`${summary.bestHour}:00`} />
            ) : null}
            {summary.firstSunHour !== null && summary.lastSunHour !== null ? (
              <Stat
                label="Solfönster"
                value={`${summary.firstSunHour}:00–${summary.lastSunHour}:00`}
              />
            ) : null}
          </div>

          {monthsSorted.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 6px", fontWeight: 600 }}>Månad</th>
                  <th style={{ padding: "8px 6px", fontWeight: 600 }}>
                    Soltimmar/dag (i snitt)
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthsSorted.map(([m, hours]) => (
                  <tr key={m} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "7px 6px", textTransform: "capitalize" }}>
                      {SWEDISH_MONTHS[m] ?? m}
                    </td>
                    <td style={{ padding: "7px 6px" }}>{hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        {factRows.length > 0 ? (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
              Praktiskt
            </h2>
            <dl style={{ margin: 0, fontSize: 14 }}>
              {factRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "150px 1fr",
                    gap: 12,
                    padding: "6px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <dt style={{ color: "#64748b" }}>{row.label}</dt>
                  <dd style={{ margin: 0 }}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
            Se på kartan
          </h2>
          <p style={{ fontSize: 14, color: "#475569", marginBottom: 12 }}>
            Soldryck-kartan visar live-vädret kombinerat med solgeometrin för {venue.name} och
            {" "}~2&nbsp;843 andra uteserveringar i Stockholm.
          </p>
          <Link
            href={`/?lat=${venue.lat}&lng=${venue.lng}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              background: "#f59e0b",
              color: "#fff",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Öppna karta
          </Link>
        </section>

        <footer
          style={{
            fontSize: 12,
            color: "#94a3b8",
            borderTop: "1px solid #e2e8f0",
            paddingTop: 16,
            marginTop: 32,
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            Soldata bygger på Stockholm stads 3D-byggnadsmodell (SBK LOD1) +{" "}
            {pluralize(Object.keys(venue.schedule).length, "ett tidstillfälle", "flera tidstillfällen")}{" "}
            ray-cast mot solpositioner från Pysolar. Träd och markiser ingår inte i modellen.
          </p>
          <p style={{ margin: 0 }}>
            Data uppdateras ungefär en gång per år.{" "}
            <Link href="/" style={{ color: "#64748b" }}>
              Tillbaka till kartan
            </Link>
            .
          </p>
        </footer>
      </article>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#fff",
        borderRadius: 10,
        border: "1px solid #f1f5f9",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
