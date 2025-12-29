const CACHE_NAME = "circle-survivor-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./collect.wav",
  "./hit.wav",
  "./music.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);

      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch (err) {
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const fallback = await cache.match("./");
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
