import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "För ägare — Soldryck",
  description:
    "Verifiera ditt ställe på Soldryck — lägg till happy hour, bilder och få en synlig verifierad-badge. Gratis under launch.",
};

const CLAIM_MAIL_SUBJECT = "Soldryck – Verifiera mitt ställe";
const CLAIM_MAIL_BODY = `Hej!\n\nJag vill verifiera mitt ställe på Soldryck.\n\nStälle (namn):\nAdress:\nKontaktperson:\nTelefon:\nE-post till verksamheten:\nHemsida:\n\nVad jag vill lägga till (happy hour, bilder etc.):\n`;

const claimMailHref = `mailto:johan.soderstrom.87@gmail.com?subject=${encodeURIComponent(
  CLAIM_MAIL_SUBJECT,
)}&body=${encodeURIComponent(CLAIM_MAIL_BODY)}`;

export default function ForRestaurantsPage() {
  return (
    <main
      style={{
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background:
          "linear-gradient(180deg, #fff7ed 0%, #fffbeb 280px, #fff 600px)",
      }}
    >
      <article
        style={{
          maxWidth: 720,
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

        {/* Hero */}
        <header style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(245,158,11,0.12)",
              color: "#b45309",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            <span aria-hidden>☀️</span>
            För ägare
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              marginBottom: 12,
            }}
          >
            Äger du ett ställe med uteservering?
          </h1>
          <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.5 }}>
            Soldryck visar Stockholms uteserveringar timme för timme — och
            stockholmarna planerar sin eftermiddag därifrån. Verifiera ditt
            ställe på 30 sekunder och få en synlig <strong>verifierad-badge</strong>,
            möjlighet att lägga till happy hour och bilder, samt
            prioritet i trending-listan.
          </p>
        </header>

        {/* Benefits grid */}
        <section style={{ marginBottom: 32 }}>
          <Benefit
            emoji="✓"
            color="#16a34a"
            title="Verifierad-badge"
            body="En grön bock i din popup som signalerar att Soldryck har koll på er. Mer förtroende, fler klick på Boka bord-knappen."
          />
          <Benefit
            emoji="🍹"
            color="#ec4899"
            title="Happy hour-glow"
            body={
              <>
                När er happy hour är igång lyser markören rosa på kartan.
                Är ett verifierat-ägar-exklusivt grafikspår — ej tillgängligt
                via vanliga OSM- eller Google-data.
              </>
            }
          />
          <Benefit
            emoji="📸"
            color="#7c3aed"
            title="Egna bilder"
            body="Ladda upp ert bästa foto i stället för Google Street View. Bilden visas i popupens hero — alla nya besökare ser den först."
          />
          <Benefit
            emoji="🔥"
            color="#f59e0b"
            title="Plats i Trending"
            body="Verifierade ställen prioriteras lätt i trending-listan när popularitet annars är likvärdig. Och en plats på topp-5 vid solfredagen drar in trafik."
          />
        </section>

        {/* How */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>
            Hur går det till?
          </h2>
          <ol
            style={{
              paddingLeft: 22,
              fontSize: 14,
              color: "#475569",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <li>
              <strong style={{ color: "#0f172a" }}>Maila oss</strong> via knappen
              nedan med ert ställes namn, adress och kontaktperson.
            </li>
            <li>
              Vi <strong style={{ color: "#0f172a" }}>verifierar</strong> att du
              är ägare/manager — vanligtvis svarar vi inom 24 h.
            </li>
            <li>
              Vi <strong style={{ color: "#0f172a" }}>lägger upp</strong> happy
              hour-tider, bilder och uppdaterad info. Du får ett kort tack-mail
              när det är klart.
            </li>
          </ol>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 14 }}>
            Det är gratis under launch-perioden. Inga avtal, inga bindningstider —
            säg bara till om ni vill ta bort er igen.
          </p>
        </section>

        {/* CTA */}
        <section
          style={{
            background: "linear-gradient(135deg, #fb923c, #f59e0b)",
            borderRadius: 22,
            padding: "22px 24px",
            color: "#fff",
            boxShadow: "0 12px 32px rgba(245,158,11,0.35)",
            marginBottom: 28,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              marginBottom: 8,
              letterSpacing: "-0.01em",
            }}
          >
            Verifiera mitt ställe
          </h2>
          <p style={{ fontSize: 14, opacity: 0.92, marginBottom: 14 }}>
            Klicka och din e-postklient öppnar ett färdigt mail med rätt
            ämne — fyll bara i några rader och skicka.
          </p>
          <a
            href={claimMailHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 20px",
              background: "#fff",
              color: "#b45309",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            ✉️ Maila oss
          </a>
        </section>

        {/* FAQ-ish footer */}
        <section style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: "#0f172a" }}>Är ni på OpenStreetMap?</strong>{" "}
            Ditt ställe ligger förmodligen redan på kartan via OSM-data. Vi
            uppdaterar bara visuell premium-info som happy hour, bilder och
            verifieringsstatus.
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: "#0f172a" }}>Vilka är ni?</strong> Soldryck
            är en hobbytjänst byggd för stockholmare som älskar sol.
          </p>
          <p>
            <strong style={{ color: "#0f172a" }}>Frågor?</strong> Maila{" "}
            <a
              href="mailto:johan.soderstrom.87@gmail.com"
              style={{ color: "#b45309" }}
            >
              johan.soderstrom.87@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}

function Benefit({
  emoji,
  color,
  title,
  body,
}: {
  emoji: string;
  color: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: 16,
        background: "#fff",
        borderRadius: 16,
        border: "0.5px solid rgba(15,23,42,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${color}1f`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 800,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    </div>
  );
}
