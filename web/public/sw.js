/* HA Office — minimal service worker (brand icons only; never cache app HTML or Next bundles) */
const CACHE = "ha-office-v3";
const PRECACHE = [
  "/brand/logo.png?v=ha-hernandez-v2",
  "/manifest.json",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function shouldBypassServiceWorker(url, request) {
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return true;
  if (request.method !== "GET") return true;
  // Next.js CSS/JS chunks change every deploy — cache-first here causes unstyled pages.
  if (url.pathname.startsWith("/_next/")) return true;
  // Never cache HTML navigations.
  if (request.mode === "navigate") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (shouldBypassServiceWorker(url, event.request)) return;

  const isPrecacheAsset = PRECACHE.some((path) => url.pathname === path || url.pathname + url.search === path);
  if (!isPrecacheAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response.ok || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
