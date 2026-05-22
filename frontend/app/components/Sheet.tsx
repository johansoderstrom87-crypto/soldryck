"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type SheetSnap = "peek" | "full" | "closed";

interface SheetProps {
  /** When true the sheet slides into view (peek on mobile, full on desktop). */
  open: boolean;
  /** Fires on drag-to-close, ESC, backdrop click (mobile-full), or programmatic close. */
  onClose: () => void;
  /** Pixel height of the peek state on mobile. Default 520. */
  peekHeight?: number;
  /** Width on desktop sidebar. Default 408. */
  desktopWidth?: number;
  /** Min viewport width that triggers desktop sidebar mode. Default 768. */
  desktopBreakpoint?: number;
  /** Whether to render the mobile drag handle. Default true. */
  showGrip?: boolean;
  /** Notified when snap state changes (parent can re-pan map etc.). */
  onSnapChange?: (snap: SheetSnap) => void;
  /** Extra class on the container, useful for variant styling. */
  className?: string;
  /**
   * Receives the live body container ref. Useful when a parent needs to
   * manipulate the body imperatively (e.g. innerHTML injection).
   */
  bodyRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * When true, scrolling the body while at the peek snap auto-expands the
   * sheet to full. Mirrors Google Maps' list-of-places behaviour where a
   * scroll gesture pulls the panel up. Mobile-only effect (desktop sidebar
   * is always "full"). Default false.
   */
  expandOnScroll?: boolean;
  /** Body content. Wrapped in a `.venue-sheet-body` scroll container. */
  children?: ReactNode;
}

/**
 * Shared sheet primitive used by both the venue details popup and the
 * "search in this area" list panel.
 *
 * Two layouts, decided by viewport width:
 *
 * - **Mobile (< desktopBreakpoint):** Google Maps-stil bottom sheet.
 *   Peek + full snap points, drag the grip to resize, drag past the
 *   lower threshold to close.
 *
 * - **Desktop (≥ desktopBreakpoint):** left sidebar sliding in from
 *   `translateX(-100%)`, fixed width, full viewport height. No drag.
 *
 * The component is purely structural — it provides the container + grip,
 * but the scrollable body content (header, list, etc.) is whatever you
 * pass as children.
 */
export default function Sheet({
  open,
  onClose,
  peekHeight = 520,
  desktopWidth = 408,
  desktopBreakpoint = 768,
  showGrip = true,
  onSnapChange,
  className,
  bodyRef,
  expandOnScroll = false,
  children,
}: SheetProps) {
  // Layout mode — recomputed on resize via matchMedia.
  const [isWide, setIsWide] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    window.matchMedia(`(min-width: ${desktopBreakpoint}px)`).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${desktopBreakpoint}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [desktopBreakpoint]);

  const [snap, setSnap] = useState<SheetSnap>("closed");
  const [vh, setVh] = useState<number>(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );

  // Drag state — refs to avoid render per pointermove frame.
  const dragRef = useRef<{
    startY: number;
    startTranslate: number;
    pointerId: number;
    active: boolean;
    moved: boolean;
  } | null>(null);
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // Internal body ref so the scroll-to-expand listener and scrollTop reset
  // work regardless of whether the parent provided a `bodyRef`. A callback
  // ref forwards the same node to both.
  const internalBodyRef = useRef<HTMLDivElement | null>(null);
  const setBodyRef = useCallback(
    (el: HTMLDivElement | null) => {
      internalBodyRef.current = el;
      if (bodyRef) {
        (bodyRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [bodyRef],
  );

  const fullHeight = Math.round(vh * 0.85);
  const effectivePeek = Math.min(peekHeight, Math.round(vh * 0.7));
  const closedTranslate = vh;
  const peekTranslate = Math.max(0, fullHeight - effectivePeek);
  const fullTranslate = 0;

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Force backdrop-filter inline (bypasses the global `* { backdrop-filter:
  // none !important }` perf rule). One static surface so the blur cost is
  // negligible.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.setProperty("backdrop-filter", "blur(30px) saturate(1.5)", "important");
    el.style.setProperty("-webkit-backdrop-filter", "blur(30px) saturate(1.5)", "important");
  }, [open, isWide]);

  // Slide in on open, slide out on close. raf-defer the first peek/full so
  // the initial render paints at "closed" translate and the snap-change
  // animates into view.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setSnap(isWide ? "full" : "peek"));
      return () => cancelAnimationFrame(id);
    }
    setSnap("closed");
    return undefined;
  }, [open, isWide]);

  useEffect(() => {
    onSnapChange?.(snap);
  }, [snap, onSnapChange]);

  // Reset scrollTop when the sheet opens fresh, so reopening doesn't land
  // mid-list. Without this, a user who closed mid-scroll would reopen at
  // peek with scrollTop>0 — which would immediately re-trigger the
  // expand-on-scroll listener and snap to full.
  useEffect(() => {
    if (open) {
      const body = internalBodyRef.current;
      if (body) body.scrollTop = 0;
    }
  }, [open]);

  // Expand-on-scroll: at peek, the first downward scroll on the body pulls
  // the sheet to full. After that, scrolling inside the full sheet works
  // normally. Mobile only — desktop sidebar is always at "full".
  useEffect(() => {
    if (!expandOnScroll || snap !== "peek") return;
    const body = internalBodyRef.current;
    if (!body) return;
    const onScroll = () => {
      if (body.scrollTop > 4) {
        setSnap("full");
      }
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
  }, [expandOnScroll, snap]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ── Drag handlers (mobile bottom-sheet only) ──────────────────────────
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary) return;
      const startTranslate = snap === "full" ? fullTranslate : peekTranslate;
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

      const closedThreshold =
        peekTranslate + (closedTranslate - peekTranslate) * 0.45;
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

  const isDragging = dragTranslate !== null;

  // ── Desktop sidebar ──
  if (isWide) {
    return (
      <div
        ref={(el) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className={`venue-sheet venue-sheet--sidebar ${className ?? ""}`}
        data-snap={open ? "full" : "closed"}
        style={{
          width: desktopWidth,
          transform: open ? "translate3d(0, 0, 0)" : "translate3d(-100%, 0, 0)",
          transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        role="dialog"
        aria-modal="false"
      >
        <div ref={setBodyRef} className="venue-sheet-body">
          {children}
        </div>
      </div>
    );
  }

  // ── Mobile bottom-sheet ──
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
      <div
        className="venue-sheet-backdrop"
        data-active={snap === "full"}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={containerRef}
        className={`venue-sheet ${className ?? ""}`}
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
        {showGrip && (
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
        )}
        <div ref={setBodyRef} className="venue-sheet-body">
          {children}
        </div>
      </div>
    </>
  );
}
