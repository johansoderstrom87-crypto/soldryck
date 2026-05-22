"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

export type SheetSnap = "peek" | "full" | "closed";

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
  /** Pixel height of the peek state. Default ~280. */
  peekHeight?: number;
}

/**
 * Google Maps-style bottom sheet for venue details.
 *
 * - Slides up from bottom on open.
 * - Two snap points: "peek" (~280 px) and "full" (~85 vh). Drag past the lower
 *   threshold collapses to closed (fires `onClose`).
 * - Body content is injected via dangerouslySetInnerHTML so the existing
 *   `buildVenuePopupHtml` string + cached fetchers (renderVenuePhoto, hours,
 *   trust) can be reused without re-implementing them as JSX.
 * - `onMount` re-runs every time `venueKey` changes, mirroring the previous
 *   Leaflet `popupopen` hook.
 */
export default function VenueSheet({
  venueKey,
  html,
  onMount,
  onClose,
  onSnapChange,
  peekHeight = 300,
}: VenueSheetProps) {
  const open = venueKey != null;

  const [snap, setSnap] = useState<SheetSnap>("closed");
  const [vh, setVh] = useState<number>(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );

  // Drag state — refs because we don't want a render per pointermove frame.
  const dragRef = useRef<{
    startY: number;
    startTranslate: number;
    pointerId: number;
    active: boolean;
    moved: boolean;
  } | null>(null);

  // Live translate during drag (px from bottom-edge resting). 0 = full.
  // null = no drag in progress, use CSS-class translate via `snap`.
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const fullHeight = Math.round(vh * 0.85);
  const closedTranslate = vh; // fully off-screen below
  const peekTranslate = Math.max(0, fullHeight - peekHeight);
  const fullTranslate = 0;

  // Track viewport for height calcs.
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Force backdrop-filter inline with !important — global rule strips blur
  // from every element to keep map-pan cheap on mobile, but the sheet is a
  // single stationary surface so the blur cost is negligible and the glass
  // look is core to the design. Same trick as the Leaflet popup patch.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.setProperty("backdrop-filter", "blur(30px) saturate(1.5)", "important");
    el.style.setProperty("-webkit-backdrop-filter", "blur(30px) saturate(1.5)", "important");
  }, [open]);

  // Open/close — when a venue is selected, slide up to peek. When it's
  // cleared, slide down to closed.
  useEffect(() => {
    if (open) {
      // Defer one frame so the initial render is at closed translate; the
      // class swap to peek then animates upward. Without this the first
      // mount would snap straight to peek with no transition.
      const id = requestAnimationFrame(() => setSnap("peek"));
      return () => cancelAnimationFrame(id);
    }
    setSnap("closed");
    return undefined;
  }, [open]);

  useEffect(() => {
    onSnapChange?.(snap);
  }, [snap, onSnapChange]);

  // Re-inject HTML + run onMount whenever the venue or html changes.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !open) return;
    body.innerHTML = html;
    if (onMount) onMount(body);
    // Reset scroll on venue change so the user sees the name row, not
    // whatever scroll position the previous venue's sheet ended at.
    body.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueKey, html]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Snap → translate. During an active drag we use the live translate
  // instead so the sheet follows the finger 1:1.
  const translate =
    dragTranslate !== null
      ? dragTranslate
      : snap === "full"
        ? fullTranslate
        : snap === "peek"
          ? peekTranslate
          : closedTranslate;

  // Drag-to-resize. Only the handle row + header zone is draggable; the body
  // content scrolls normally. This mirrors iOS/Google Maps behaviour where
  // you grab the top of the card to resize but the body inside is its own
  // scroll surface.
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Ignore right-clicks / multi-touch — single primary pointer only.
      if (!e.isPrimary) return;
      const startTranslate =
        snap === "full" ? fullTranslate : peekTranslate;
      dragRef.current = {
        startY: e.clientY,
        startTranslate,
        pointerId: e.pointerId,
        active: true,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragTranslate(startTranslate);
    },
    [snap, fullTranslate, peekTranslate],
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || !d.active || e.pointerId !== d.pointerId) return;
      const dy = e.clientY - d.startY;
      // Allow drag past full (negative) only by a small amount, so the sheet
      // doesn't fly off the top. Allow dragging down past peek freely so the
      // user can flick it closed.
      const next = Math.max(-20, d.startTranslate + dy);
      if (Math.abs(dy) > 4) d.moved = true;
      setDragTranslate(next);
    },
    [],
  );

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || !d.active || e.pointerId !== d.pointerId) return;
      d.active = false;
      const finalTranslate = dragTranslate ?? d.startTranslate;
      setDragTranslate(null);

      // Snap to nearest of: full, peek, closed — with a closed threshold
      // halfway between peek and fully off-screen.
      const closedThreshold = peekTranslate + (closedTranslate - peekTranslate) * 0.45;
      if (finalTranslate > closedThreshold) {
        onClose();
        return;
      }
      // Between full and peek — pick whichever is closer.
      const midFullPeek = (fullTranslate + peekTranslate) / 2;
      setSnap(finalTranslate < midFullPeek ? "full" : "peek");
    },
    [dragTranslate, peekTranslate, closedTranslate, fullTranslate, onClose],
  );

  const onHandleClick = useCallback(() => {
    // A tap on the handle without a drag toggles full ⇄ peek.
    if (dragRef.current?.moved) return;
    setSnap((s) => (s === "full" ? "peek" : "full"));
  }, []);

  // Don't render anything when fully closed AND no venue was ever opened
  // (initial mount). Once a venue has been opened we keep the node mounted
  // so the slide-down animation can play out.
  const [hasEverOpened, setHasEverOpened] = useState(false);
  useEffect(() => {
    if (open) setHasEverOpened(true);
  }, [open]);
  if (!hasEverOpened) return null;

  const isDragging = dragTranslate !== null;

  return (
    <>
      {/* Backdrop — only visible at "full". Click closes. Pointer-events off
          at peek so the user can still pan the map below the sheet. */}
      <div
        className="venue-sheet-backdrop"
        data-active={snap === "full"}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={containerRef}
        className="venue-sheet"
        data-snap={snap}
        data-dragging={isDragging ? "true" : "false"}
        style={{
          height: fullHeight,
          transform: `translate3d(0, ${translate}px, 0)`,
          transition: isDragging
            ? "none"
            : "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        role="dialog"
        aria-modal={snap === "full"}
      >
        <div
          className="venue-sheet-grip"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onClick={onHandleClick}
        >
          <div className="venue-sheet-handle" aria-hidden />
        </div>
        <div ref={bodyRef} className="venue-sheet-body" />
      </div>
    </>
  );
}
