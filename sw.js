const CACHE_NAME = "circle-survivor-v9";
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

const FONT_URLS = [
  "https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&family=Lilita+One&display=swap",
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => {
      return caches.open(CACHE_NAME).then((cache) =>
        Promise.all(
          FONT_URLS.map((url) =>
            cache.add(url).catch(() => {
              // Ignore font pre-cache failures; runtime caching will still try.
              return null;
            })
          )
        )
      );
    })
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
  const isFont = url.origin.includes("fonts.googleapis.com") || url.origin.includes("fonts.gstatic.com");
  if (url.origin !== self.location.origin && !isFont) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    const fetchAndCache = async () => {
      const res = await fetch(event.request);
      if (res && res.ok) {
        cache.put(event.request, res.clone());
      }
      return res;
    };

    try {
      // Fonts: prefer cache-first to avoid flash/failure offline.
      if (isFont) {
        if (cached) return cached;
        return await fetchAndCache();
      }

      const res = await fetchAndCache();
      return res;
    } catch (err) {
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const fallback = await cache.match("./");
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
