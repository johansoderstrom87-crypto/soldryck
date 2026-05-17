import type { Metadata, Viewport } from "next";
import { Geist, Inter, Outfit } from "next/font/google";
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

const SITE_URL = "https://soldryck-web-production.up.railway.app";
const TITLE = "Soldryck — Hitta solen i Stockholm";
const DESCRIPTION =
  "Se vilka uteserveringar i Stockholm som har sol just nu, timme för timme. " +
  "Baserat på riktiga 3D-byggnadsmodeller och solpositionsberäkningar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.json",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${geistSans.variable} ${inter.variable} ${outfit.variable} h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
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
