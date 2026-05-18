/**
 * Lightweight privacy-first analytics + error tracking.
 *
 * Persists anonymous aggregate events to our own Postgres (via /api/events)
 * instead of a third-party SaaS — no cookies, no tracking pixels, no
 * cross-site identifiers. Respects Do-Not-Track and skips events entirely
 * when the user has opted out at the browser level.
 *
 * Events are batched in-memory and flushed via `sendBeacon` so they don't
 * block UI threads or get lost when the page unloads. If you ever want to
 * swap this out for Plausible/Sentry, the only producer-side change is to
 * replace `sendBatch()` below with their SDK call — every call site can
 * keep using `track()` unchanged.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

interface QueuedEvent {
  name: string;
  props: EventProps;
  t: number; // epoch ms
}

const ENDPOINT = "/api/events";
const FLUSH_INTERVAL_MS = 3_000;
const MAX_QUEUE = 50;
const MAX_PROP_VALUE_LEN = 200;

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sessionId: string | null = null;
let disabledReason: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "ssr";
  try {
    let v = sessionStorage.getItem("sld_sid");
    if (!v) {
      v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("sld_sid", v);
    }
    sessionId = v;
    return v;
  } catch {
    return "no-session-storage";
  }
}

function isDisabled(): boolean {
  if (disabledReason) return true;
  if (typeof window === "undefined") return true;
  // Do-Not-Track + the modern globalPrivacyControl signal. Either one means
  // skip — don't argue with the user.
  const nav = window.navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) {
    disabledReason = "dnt";
    return true;
  }
  return false;
}

/** Clip prop values to keep payloads predictable and avoid PII leaking. */
function sanitiseProps(p: EventProps): EventProps {
  const out: EventProps = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (typeof v === "string") {
      out[k] = v.length > MAX_PROP_VALUE_LEN ? v.slice(0, MAX_PROP_VALUE_LEN) : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

function sendBatch(batch: QueuedEvent[]): void {
  if (typeof window === "undefined" || batch.length === 0) return;
  const payload = JSON.stringify({
    sessionId: getSessionId(),
    events: batch,
    // Page hint helps with grouping in the admin view; truncated to keep
    // payloads small and to avoid query-string fingerprinting.
    path: window.location.pathname,
  });
  try {
    if (navigator.sendBeacon) {
      // sendBeacon is fire-and-forget — survives page unload, blocking-free.
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(() => { /* swallow — analytics must never break the app */ });
    }
  } catch {
    // sendBeacon can throw on Firefox in private mode — just drop.
  }
}

function flush() {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  sendBatch(batch);
}

/**
 * Record an event. The call is fire-and-forget — it's safe to call from any
 * code path, never throws, and is a no-op when DNT is on or during SSR.
 *
 * Examples:
 *   track("find_sun_clicked", { result: "success" })
 *   track("popup_opened", { type: "rooftop", confirmed: true })
 */
export function track(name: string, props: EventProps = {}): void {
  if (isDisabled()) return;
  queue.push({ name, props: sanitiseProps(props), t: Date.now() });
  if (queue.length >= MAX_QUEUE) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Capture window-level JS errors + unhandled promise rejections. Call once,
 * from a client-side mount (e.g. RootLayout's effect).
 *
 * We deliberately do NOT capture every <Component> error here — keep that
 * for a future React error boundary if needed. window.onerror catches the
 * top-level surprises that would otherwise just disappear into the console.
 */
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    track("client_error", {
      message: event.message || "unknown",
      source: event.filename ? new URL(event.filename, window.location.href).pathname : "",
      line: event.lineno ?? null,
      col: event.colno ?? null,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message :
                typeof reason === "string" ? reason :
                JSON.stringify(reason).slice(0, MAX_PROP_VALUE_LEN);
    track("unhandled_rejection", { message: msg });
  };
  const onPageHide = () => flush();
  const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
