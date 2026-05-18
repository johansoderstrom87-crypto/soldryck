import { useEffect } from "react";
import type L from "leaflet";

/**
 * Toggleable RainViewer radar overlay. Pulls the public weather-maps.json
 * metadata, attaches the latest frame as a tile layer, and refreshes every
 * 5 min (their frames update every 10 min) until the toggle goes off or
 * the component unmounts.
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

    async function refresh() {
      if (cancelled) return;
      const m = mapRef.current;
      if (!m) return;
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
    };
  }, [showRain, mapRef]);
}
