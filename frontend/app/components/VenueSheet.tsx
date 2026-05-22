"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Sheet, { type SheetSnap } from "./Sheet";

export type { SheetSnap };

interface VenueSheetProps {
  /** Stable id for the currently shown venue. Changing it = rebuild content. */
  venueKey: string | number | null;
  /** Pre-built HTML for the sheet body. */
  html: string;
  /** Called after `html` is injected into the DOM; attach event handlers here. */
  onMount?: (container: HTMLElement) => void;
  /** Called when sheet collapses to closed (drag down, ESC, close button, backdrop). */
  onClose: () => void;
  /** Called when snap state changes (so the map can re-pan if needed). */
  onSnapChange?: (snap: SheetSnap) => void;
  /** Pixel height of the peek state on mobile. Default 520. */
  peekHeight?: number;
}

/**
 * Venue details popup rendered as a Google Maps-style sheet.
 *
 * Thin wrapper around the shared `<Sheet>` primitive that injects the
 * pre-built popup HTML string into the body and re-runs `onMount`
 * whenever the venue (and therefore the HTML) changes. The HTML-injection
 * is what required this component to be separate from the generic Sheet:
 * Leaflet's popup template is a string with embedded ids/classes that the
 * caller needs to bind event handlers to imperatively.
 */
export default function VenueSheet({
  venueKey,
  html,
  onMount,
  onClose,
  onSnapChange,
  peekHeight = 520,
}: VenueSheetProps) {
  const open = venueKey != null;
  const bodyRef = useRef<HTMLDivElement>(null);
  // `open` driven also into a separate ref so the layout effect can read
  // the latest open state even if React batches a close+venueKey change.
  const openRef = useRef(open);
  openRef.current = open;

  // Inject HTML + run onMount whenever venue or html changes. Layout
  // effect (not regular effect) so the DOM is ready before paint.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !openRef.current) return;
    body.innerHTML = html;
    if (onMount) onMount(body);
    body.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueKey, html]);

  // When the user closes the sheet, the html effect doesn't re-fire on
  // re-open with the same venue (deps unchanged). Catch that case here:
  // when `open` flips false→true and we still have html, inject on the
  // next paint. (First-mount also flows through this.)
  useEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body || !html) return;
    if (body.innerHTML.length === 0) {
      body.innerHTML = html;
      if (onMount) onMount(body);
      body.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onSnapChange={onSnapChange}
      peekHeight={peekHeight}
      bodyRef={bodyRef}
    />
  );
}
