const CACHE_NAME = "soldryck-v1";
const PRECACHE = ["/", "/manifest.json", "/icons/icon.svg"];

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
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
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

  // Network-first for HTML and API, cache-first for assets
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
  } else {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
