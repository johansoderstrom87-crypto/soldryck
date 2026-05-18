// Bumped on cache-strategy change — old caches will be deleted on activate.
const CACHE_NAME = "soldryck-v4";
const OFFLINE_URL = "/offline";
const PRECACHE = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Per-route TTLs for /api/* fallback. The previous version cached every API
// response indefinitely as offline fallback, which meant a user opening the
// app offline could see "open" / "closed" data that was hours or days stale.
// These TTLs are upper bounds on how stale a *fallback* response can be —
// the network-first strategy still returns fresh data when online.
//
// Routes not listed fall back to DEFAULT_API_TTL. Time-sensitive routes
// (venue-hours) are kept short; static-ish routes (photos, shadows) can
// linger.
const API_TTL = {
  "/api/venue-hours":     5 * 60 * 1000,        // 5 min — open/closed flips often
  "/api/claimed-venues":  10 * 60 * 1000,       // 10 min — admin edits should propagate
  "/api/venue-photo":     7 * 24 * 60 * 60 * 1000, // 7 days — photos rarely change
  "/api/shadows":         24 * 60 * 60 * 1000,  // 24 h — recomputed yearly at most
};
const DEFAULT_API_TTL = 15 * 60 * 1000; // 15 min

// We tag cached API responses with a `sw-cached-at` header so we can check
// age on read. The original Response is otherwise untouched.
function timestamp(response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", String(Date.now()));
  return response.blob().then((b) => new Response(b, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }));
}

function isFresh(response, ttl) {
  const cachedAt = Number(response.headers.get("sw-cached-at") || 0);
  if (!cachedAt) return false;
  return Date.now() - cachedAt < ttl;
}

function ttlFor(pathname) {
  for (const prefix in API_TTL) {
    if (pathname.startsWith(prefix)) return API_TTL[prefix];
  }
  return DEFAULT_API_TTL;
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (e) => {
  if (!e.data) return;
  let payload = {};
  try { payload = e.data.json(); } catch { payload = { title: "Soldryck", body: e.data.text() }; }
  const { title = "Soldryck", body = "", url = "/" } = payload;
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      tag: "soldryck-sun",
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  // Skip non-GET and external API calls
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith("/api/");
  const isNavigate = request.mode === "navigate";

  if (isApi) {
    // Network-first with TTL-bounded cache fallback. If the network call
    // fails AND we have a cached copy that's within the route's TTL, return
    // it. Otherwise propagate the failure so the app can show its own
    // empty/error state rather than stale data.
    const ttl = ttlFor(url.pathname);
    e.respondWith(
      fetch(request)
        .then((res) => {
          // Only cache successful responses
          if (res.ok) {
            const clone = res.clone();
            timestamp(clone).then((stamped) => {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, stamped));
            });
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached && isFresh(cached, ttl)) return cached;
          // Cache miss or stale — return a synthetic 503 so callers can fall
          // back to UI defaults instead of getting day-old data.
          return new Response(JSON.stringify({ error: "offline-stale" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }

  if (isNavigate) {
    // Network-first for HTML — falls back to whatever's cached (no TTL —
    // a stale shell is fine, the app rehydrates from live data on connect).
    // If neither network nor cache works, fall back to the precached
    // /offline page so we never show the browser's default error chrome.
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets: cache-first.
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
