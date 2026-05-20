import type { Metadata, Viewport } from "next";
import { Geist, Inter, Outfit } from "next/font/google";
// Self-host Leaflet's stylesheet via the npm package — bundled by Next so
// it's served from the same origin (no render-blocking third-party request
// + no single-point-of-failure on unpkg). MUST come before globals.css so
// our own .leaflet-* overrides can win on specificity ties.
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const SITE_URL = "https://soldryck.se";
const TITLE = "Soldryck — Hitta solen i Stockholm";
const DESCRIPTION =
  "Se vilka uteserveringar i Stockholm som har sol just nu, timme för timme. " +
  "Baserat på riktiga 3D-byggnadsmodeller och solpositionsberäkningar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.json",
  // Favicon hierarchy — without these the desktop tab shows the empty
  // placeholder favicon. Modern browsers prefer SVG (sharp at every size),
  // falling back to the PNGs for Safari/iOS and apple-touch-icon for the
  // home-screen tile on legacy iOS.
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    // Use black-translucent so iOS extends the app under the notch and lets
    // our viewportFit=cover safe-area padding handle the layout.
    statusBarStyle: "black-translucent",
    title: "Soldryck",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  // Social previews — without these the link preview on WhatsApp / Slack /
  // Twitter / FB is just the URL with no image or description.
  // TODO: generate a 1200×630 hero (map screenshot + tagline) and save as
  // /public/og-image.png, then add it as the first image below for a proper
  // landscape preview. Until then logo.png is used (tall-aspect — most
  // crawlers will still display it, just letterboxed).
  openGraph: {
    type: "website",
    locale: "sv_SE",
    url: SITE_URL,
    siteName: "Soldryck",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      { url: "/logo.png", width: 896, height: 1167, alt: "Soldryck — sol i Stockholm" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

// viewportFit=cover lets the app draw under the iPhone notch / home indicator.
// We then pad fixed UI back in via env(safe-area-inset-*) in CSS so nothing
// is hidden behind the system bars.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f59e0b",
};

// Schema.org structured data — server-rendered so crawlers (Google) and
// AI-svartjänster (ChatGPT-search, Perplexity, Claude) ser entitetstypen
// utan att behöva exekvera JS. WebApplication är rätt typ för en gratis
// kart-webapp; areaServed pekar på Stockholm vilket hjälper geo-relevans.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Soldryck",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "TravelApplication",
  operatingSystem: "Web",
  inLanguage: "sv-SE",
  isAccessibleForFree: true,
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "SEK",
  },
  areaServed: {
    "@type": "City",
    name: "Stockholm",
    addressCountry: "SE",
  },
  featureList: [
    "Soldata per uteservering timme för timme",
    "Baserat på 3D-byggnadsmodeller (Stockholm Dataportalen SBK LOD1)",
    "Solpositionsberäkning via ray-casting",
    "Väderprognos från SMHI",
    "Filter på takbarer, tunnelbanestation, öppettider",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${geistSans.variable} ${inter.variable} ${outfit.variable} h-full`}>
      <head>
        {/* Leaflet CSS is imported via `import "leaflet/dist/leaflet.css"`
            in this file — Next bundles + serves from the same origin.
            Icons handled by Next's metadata.icons — see above. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="h-full overflow-hidden">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"))`,
          }}
        />
      </body>
    </html>
  );
}
