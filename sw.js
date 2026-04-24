const CACHE_NAME = "kizuki-ios-web-beta-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=20260424-safari-search",
  "./app.js?v=20260424-safari-search",
  "./dom-helpers.mjs?v=20260424-safari-search",
  "./name-search.mjs?v=20260424-safari-search",
  "./speech-support.mjs?v=20260424-safari-search",
  "./storage-logic.mjs?v=20260424-safari-search",
  "./ui-logic.mjs?v=20260424-safari-search",
  "./manifest.webmanifest",
  "./icon.svg",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all([
        ...keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        self.clients.claim(),
      ]),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const prefersFreshCopy =
    isSameOrigin &&
    ["document", "script", "style", "manifest"].includes(event.request.destination);

  if (prefersFreshCopy) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
