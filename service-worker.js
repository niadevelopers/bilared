const CACHE_NAME = "bilared-cache-v3";
const urlsToCache = [
  "/",
  "/index.html",
  "/how-to-play.html",
  "/disclaimer.html",
  "/style.css",
  "/script.js",
  "/howToPlay.js",
  "/installPrompt.js",
  "/playerCount.js",
  "/notification.js",
  "/demo.js",
  "/demo_mode.html",
  "/images/cat.png"
];

async function forceCache(url, cache) {
  let cached = false;
  while (!cached) {
    try {
      await cache.add(url);
      cached = true;
      console.log(`[Service Worker] Cached: ${url}`);
    } catch (err) {
      console.warn(`[Service Worker] Retry caching ${url} due to error:`, err);
      await new Promise(res => setTimeout(res, 500));
    }
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of urlsToCache) {
        await forceCache(url, cache);
      }
      console.log("[Service Worker] All files cached forcefully.");
    })()
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    })()
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
