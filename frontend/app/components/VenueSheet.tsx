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
  /**
   * Pixel height of the peek state on mobile. Default ~520 so the sun
   * timeline diagram and the "Bästa timmen" button are both visible on
   * first open without the user having to drag the sheet up.
   */
  peekHeight?: number;
}

const DESKTOP_BREAKPOINT_PX = 768;

/**
 * Venue details panel — adapts between two layouts based on viewport width:
 *
 * - **Mobile (< 768 px):** Google Maps-stil bottom sheet. Slides up from the
 *   bottom; peek (~520 px showing through the timeline) + full (~85 vh)
 *   snap points; drag past the lower threshold collapses to closed.
 *
 * - **Desktop (≥ 768 px):** Google Maps-stil left sidebar. Fixed width
 *   (408 px), full viewport height, slides in from the left. No drag /
 *   snap — the in-panel close button or ESC dismisses it.
 *
 * Body content is injected via dangerouslySetInnerHTML so the existing
 * `buildVenuePopupHtml` string + cached fetchers (renderVenuePhoto, hours,
 * trust) can be reused without re-implementing them as JSX. `onMount`
 * re-runs every time `venueKey` changes, mirroring the previous Leaflet
 * `popupopen` hook.
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

  // Layout mode — recomputed on resize. We use matchMedia (not just a
  // resize listener on innerWidth) so the breakpoint logic stays in one
  // place and matches what CSS media queries would do.
  const [isWide, setIsWide] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  // Bottom-sheet geometry. Scales peek with viewport so on short screens
  // (vh ~600) the peek doesn't take the entire view; on tall screens it
  // caps at `peekHeight` so the sheet doesn't grow unnecessarily large.
  const fullHeight = Math.round(vh * 0.85);
  const effectivePeek = Math.min(peekHeight, Math.round(vh * 0.7));
  const closedTranslate = vh; // fully off-screen below
  const peekTranslate = Math.max(0, fullHeight - effectivePeek);
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
  }, [open, isWide]);

  // Open/close — when a venue is selected, slide up to peek (mobile) or
  // slide in (desktop). When cleared, slide back to closed.
  useEffect(() => {
    if (open) {
      // Defer one frame so the initial render is at closed translate; the
      // class swap to peek then animates upward. Without this the first
      // mount would snap straight to peek with no transition.
      const id = requestAnimationFrame(() => setSnap(isWide ? "full" : "peek"));
      return () => cancelAnimationFrame(id);
    }
    setSnap("closed");
    return undefined;
  }, [open, isWide]);

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

  // Drag-to-resize — only used on mobile bottom-sheet. The desktop sidebar
  // is not draggable; it uses the in-panel close button or ESC instead.
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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

      const closedThreshold = peekTranslate + (closedTranslate - peekTranslate) * 0.45;
      if (finalTranslate > closedThreshold) {
        onClose();
        return;
      }
      const midFullPeek = (fullTranslate + peekTranslate) / 2;
      setSnap(finalTranslate < midFullPeek ? "full" : "peek");
    },
    [dragTranslate, peekTranslate, closedTranslate, fullTranslate, onClose],
  );

  const onHandleClick = useCallback(() => {
    if (dragRef.current?.moved) return;
    setSnap((s) => (s === "full" ? "peek" : "full"));
  }, []);

  // Don't render anything when fully closed AND no venue was ever opened.
  // Once a venue has been opened we keep the node mounted so the close
  // animation can play out.
  const [hasEverOpened, setHasEverOpened] = useState(false);
  useEffect(() => {
    if (open) setHasEverOpened(true);
  }, [open]);
  if (!hasEverOpened) return null;

  const isDragging = dragTranslate !== null;

  // ── Desktop sidebar layout ──────────────────────────────────────────
  if (isWide) {
    return (
      <div
        ref={containerRef}
        className="venue-sheet venue-sheet--sidebar"
        data-snap={open ? "full" : "closed"}
        style={{
          transform: open ? "translate3d(0, 0, 0)" : "translate3d(-100%, 0, 0)",
          transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        role="dialog"
        aria-modal="false"
      >
        <div ref={bodyRef} className="venue-sheet-body" />
      </div>
    );
  }

  // ── Mobile bottom-sheet layout ──────────────────────────────────────
  const translate =
    dragTranslate !== null
      ? dragTranslate
      : snap === "full"
        ? fullTranslate
        : snap === "peek"
          ? peekTranslate
          : closedTranslate;

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
