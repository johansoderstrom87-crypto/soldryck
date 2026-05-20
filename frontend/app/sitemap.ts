import type { MetadataRoute } from "next";
import { getAllVenues } from "./lib/venue-data";
import { venueSlug } from "./lib/slug";

const SITE_URL = "https://soldryck.se";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const venues = getAllVenues();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/uteservering`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/for-restaurants`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // En sida per venue. ~2 843 URL:er — väl under Googles 50 000-gräns
  // per sitemap, så ingen split behövs ännu. Lastmod sätts till nu eftersom
  // sol-data uppdateras vid varje pipeline-körning och vi inte spårar per-venue.
  const venueEntries: MetadataRoute.Sitemap = venues.map((v) => ({
    url: `${SITE_URL}/uteservering/${venueSlug(v)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...venueEntries];
}
