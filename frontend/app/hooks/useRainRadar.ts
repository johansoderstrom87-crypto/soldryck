import { useEffect } from "react";
import type L from "leaflet";

// RainViewer's tile API only renders radar data up to zoom 7 — every tile
// requested past that returns the same "zoom level not supported"
// placeholder image, regardless of {x}/{y}. Confirmed by diffing tile
// bytes directly: z8 through z18 are byte-identical.
const RAIN_RADAR_MAX_ZOOM = 7;

/**
 * Toggleable RainViewer radar overlay. Pulls the public weather-maps.json
 * metadata, attaches the latest frame as a tile layer, and refreshes every
 * 5 min (their frames update every 10 min) until the toggle goes off or
 * the component unmounts.
 *
 * While active, clamps the map to RAIN_RADAR_MAX_ZOOM (zooming out first
 * if the user was already closer in) so radar tiles always resolve, and
 * restores the map's normal zoom ceiling on deactivate/unmount.
 *
 * Lives in its own hook because the effect is self-contained — only the
 * map ref + a single boolean prop are needed. The same extraction pattern
 * fits the shadow overlay, metro layer, and geolocation effects when we
 * decide to keep splitting SunMap further.
 */
export function useRainRadar(
  mapRef: React.MutableRefObject<L.Map | null>,
  showRain: boolean,
): void {
  useEffect(() => {
    if (!showRain) return;

    let rainLayer: L.TileLayer | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let previousMaxZoom: number | null = null;

    async function refresh() {
      if (cancelled) return;
      const m = mapRef.current;
      if (!m) return;

      if (previousMaxZoom === null) {
        previousMaxZoom = m.getMaxZoom();
        m.setMaxZoom(RAIN_RADAR_MAX_ZOOM);
        if (m.getZoom() > RAIN_RADAR_MAX_ZOOM) {
          m.setZoom(RAIN_RADAR_MAX_ZOOM);
        }
      }

      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!res.ok) return;
        const data = await res.json();
        const frames = (data?.radar?.past ?? []) as Array<{ path: string; time: number }>;
        const latest = frames[frames.length - 1];
        if (!latest || cancelled) return;
        const host = data.host as string | undefined;
        if (!host) return;

        const L = await import("leaflet");
        const next = L.tileLayer(
          `${host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
          {
            opacity: 0.55,
            maxZoom: 19,
            attribution: '<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a>',
          },
        ).addTo(m);

        // Cross-fade: add the new layer, then remove the old after one frame.
        if (rainLayer) {
          const old = rainLayer;
          setTimeout(() => old.remove(), 100);
        }
        rainLayer = next;
      } catch { /* silently ignore — radar is non-critical */ }

      timer = setTimeout(refresh, 5 * 60 * 1000);
    }

    refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (rainLayer) rainLayer.remove();
      const m = mapRef.current;
      if (m && previousMaxZoom !== null) {
        m.setMaxZoom(previousMaxZoom);
      }
    };
  }, [showRain, mapRef]);
}
