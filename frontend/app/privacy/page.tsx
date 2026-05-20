import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integritet — Soldryck",
  description: "Vad Soldryck lagrar om dig och varför.",
};

const UPDATED = "2026-05-17";

export default function PrivacyPage() {
  return (
    <main
      style={{
        // RootLayout uses overflow:hidden on <body> for the map; this page
        // needs to scroll its own content instead.
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "linear-gradient(180deg, #fffbeb 0%, #fff 200px)",
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "calc(28px + var(--safe-top, 0px)) 20px calc(40px + var(--safe-bottom, 0px))",
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

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
        Integritet
      </h1>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 28 }}>
        Senast uppdaterad: {UPDATED}
      </p>

      <p style={{ fontSize: 15, color: "#334155", marginBottom: 28 }}>
        Soldryck är en gratis hobbytjänst som visar var solen träffar Stockholms
        uteserveringar. Vi samlar in så lite som möjligt om dig — här är hela
        listan.
      </p>

      <Section title="Position (GPS)">
        <p>
          När du trycker på GPS-knappen eller &quot;Hitta solen&quot; frågar webbläsaren
          om tillstånd att dela din plats. Positionen används{" "}
          <strong>bara lokalt i din webbläsare</strong> för att rita en blå
          punkt på kartan och räkna ut närmaste solplats. Den skickas{" "}
          <strong>aldrig</strong> till vår server och sparas ingenstans.
        </p>
        <p>Du kan när som helst neka eller återkalla tillståndet i webbläsarens inställningar.</p>
      </Section>

      <Section title="LocalStorage på din enhet">
        <p>För att appen ska kännas snabb och kommer-ihåg lagrar vi följande lokalt i din webbläsare:</p>
        <ul>
          <li><strong>Favoriter</strong> — lista över venue-ID:n du sparat.</li>
          <li><strong>Sync-kod</strong> — om du valt att synka favoriter till andra enheter (6-tecken-kod).</li>
          <li><strong>Väder-cache</strong> — senaste SMHI-prognosen, max 30 min gammal.</li>
          <li><strong>Onboarding-flag</strong> — så vi inte visar välkomstturen varje gång.</li>
        </ul>
        <p>
          Inget av detta lämnar din enhet. Rensar du webbplatsdata försvinner allt.
        </p>
      </Section>

      <Section title="Synka favoriter mellan enheter">
        <p>
          Om du använder &quot;Synka till andra enheter&quot; skapar vi en{" "}
          <strong>anonym 6-teckens-kod</strong> som mappar till en lista över
          venue-id:n du sparat. Inget om vem du är — bara koden och listan.
        </p>
        <p>
          Vem som helst som har koden kan läsa eller skriva över listan. Behandla
          den som ett lösenord — dela bara med enheter du litar på. Du kan generera
          en ny när som helst i favorit-panelen.
        </p>
      </Section>

      <Section title="Push-notiser (valfritt)">
        <p>
          Om du aktiverar &quot;Notifiera mig när favoriter har sol&quot; lagrar vi:
        </p>
        <ul>
          <li>En anonym <strong>push-endpoint</strong> som webbläsaren ger oss.</li>
          <li>Listan över <strong>venue-ID:n</strong> du vill bevakas.</li>
          <li>Datum då vi senast skickat dig en notis (för att inte spamma).</li>
        </ul>
        <p>
          Vi kopplar inte ihop det här med din identitet — vi vet inte vem du
          är, bara att en anonym prenumerant vill ha notiser om vissa ställen.
          Stänger du av notiserna tar vi bort prenumerationen direkt.
        </p>
      </Section>

      <Section title="Feedback &amp; förslag">
        <p>
          Om du skickar feedback (&quot;Stämmer inte?&quot;) eller ett förslag sparar vi
          texten du skriver plus venue-ID/namn. Inget annat — vi kopplar inte
          texten till din IP-adress eller webbläsare.
        </p>
        <p>
          Om du i feedback-texten skriver något identifierande (t.ex. namn
          eller email) lagras det förstås — så undvik det om du vill vara
          anonym.
        </p>
      </Section>

      <Section title="Anspråk på ett ställe (för ägare)">
        <p>
          Klickar du på &quot;Äger du det här?&quot; öppnas din vanliga e-postapp så att
          du själv skickar oss kontaktuppgifter. Vi får dem alltså via mail,
          inte automatiskt via appen.
        </p>
      </Section>

      <Section title="Cookies &amp; analytics">
        <p>
          Vi använder <strong>inga cookies</strong>, inga reklamnätverk och inga
          tredjepartsspårare. Hosting-leverantören (Railway) ser vanliga
          åtkomstloggar som varje webbserver gör.
        </p>
        <p>
          För att förstå vilka funktioner som faktiskt används loggar vi{" "}
          <strong>anonyma händelseräknare</strong> i vår egen databas:
          knappklick som &quot;Hitta solen&quot;, &quot;Favorit tillagd&quot;, popup-öppningar
          (bara venue-typ — restaurang/café/bar/takbar) och liknande. Vi sparar
          <strong> ingen IP-adress, inget användar-id och ingen koppling
          till dig som person</strong> — bara en slumpmässig session-id som
          rensas när du stänger fliken.
        </p>
        <p>
          Om din webbläsare skickar <strong>Do-Not-Track</strong> eller{" "}
          <strong>Global Privacy Control</strong> stänger vi av all
          händelseloggning helt automatiskt.
        </p>
      </Section>

      <Section title="Felrapportering">
        <p>
          Om något kraschar i webbläsaren skickar vi en kort sammanfattning
          (felmeddelande + fil + radnummer) till vår egen databas så vi kan
          fixa buggar. Inget om sidans innehåll eller om dig — bara
          stacktrace-fragmentet. Stängs också av av Do-Not-Track.
        </p>
      </Section>

      <Section title="Tredjepartstjänster">
        <ul>
          <li><strong>SMHI</strong> — väderprognos hämtas direkt från SMHI:s öppna API. Din IP syns för SMHI när din webbläsare hämtar prognosen.</li>
          <li><strong>OpenStreetMap / CARTO</strong> — kartrutor. Din IP syns för deras CDN.</li>
          <li><strong>Google Maps</strong> — vi länkar dit för vägbeskrivningar. Du går till Google bara om du själv klickar.</li>
        </ul>
      </Section>

      <Section title="Dina rättigheter">
        <p>
          Eftersom vi inte kopplar data till din identitet kan vi inte hämta
          eller radera &quot;just din&quot; information på begäran. Det du kan göra:
        </p>
        <ul>
          <li>Rensa webbplatsdata för soldryck.se i webbläsaren → favoriter, cache och onboarding försvinner.</li>
          <li>Stänga av push-notiser i favorit-panelen → endpoint raderas direkt.</li>
          <li>Maila <a href="mailto:johan.soderstrom.87@gmail.com" style={{ color: "#b45309" }}>johan.soderstrom.87@gmail.com</a> om något feedbackmeddelande du skickat ska raderas.</li>
        </ul>
      </Section>

      <Section title="Kontakt">
        <p>
          Frågor? Maila <a href="mailto:johan.soderstrom.87@gmail.com" style={{ color: "#b45309" }}>johan.soderstrom.87@gmail.com</a>.
        </p>
      </Section>

        <style>{`
          .privacy-section ul { padding-left: 22px; margin: 8px 0; }
          .privacy-section li { margin-bottom: 4px; }
          .privacy-section p { margin-bottom: 10px; }
          .privacy-section p:last-child { margin-bottom: 0; }
          .privacy-section a { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
        `}</style>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="privacy-section" style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: "#0f172a" }}>{title}</h2>
      <div style={{ fontSize: 14, color: "#475569" }}>
        {children}
      </div>
    </section>
  );
}
