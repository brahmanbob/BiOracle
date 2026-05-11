/* BiOracle service worker — sovereign app-shell cache.
 * Cache the static app shell so the triage UI launches even with no signal.
 * Sensor + ledger calls always go to network (never cached).
 */
const VERSION = "bioracle-v3-golden-relic";
const CORE = ["/", "/index.html", "/manifest.json",
              "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png",
              "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Auto-Stealth periodic-sync hint — only fires if browser grants the permission
// (rare; opt-in via Site Settings). Posts a wake message to all open clients so
// the in-page useAutoStealth tick stays alive even between visibility flips.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "bo.autostealth") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "bo.autostealth.tick" }));
      })
    );
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Never cache API or sensor-data endpoints
  if (url.pathname.startsWith("/api/")) {
    return; // bypass — let network handle it
  }

  // Cache-first for static, network-update in background
  if (req.method === "GET" && (url.origin === self.location.origin)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fetcher = fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(req, clone).catch(() => {}));
          }
          return res;
        }).catch(() => hit);
        return hit || fetcher;
      })
    );
  }
});
