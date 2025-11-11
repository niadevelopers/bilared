const CACHE_NAME = "bilared-cache-v2.1";
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
  "/how-ToPlay.js",
  "/demo_mode.html",
  "/images/cat.png",
  "/images/cat-blue.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  
  self.skipWaiting();
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
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
