const CACHE_NAME = "bilared-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/how-to-play.html",
  "/disclaimer.html",
  "/style.css",
  "/script.js",
  "/images/cat.png",
  "/images/cat-blue.png"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching app shell...");
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
