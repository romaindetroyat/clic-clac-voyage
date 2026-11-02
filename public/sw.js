/*
 * Service worker de Clic-Clac Voyage (phase 1 : squelette).
 * - met en cache la page « hors ligne » et les ressources statiques de Next ;
 * - réseau d'abord pour les pages, avec repli sur la page hors ligne.
 * Les phases suivantes ajouteront la file d'envoi et la lecture hors ligne du site.
 */
const VERSION = "v1";
const CACHE_STATIQUE = `statique-${VERSION}`;
const PAGE_HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_STATIQUE).then((c) => c.addAll([PAGE_HORS_LIGNE, "/icones/192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE_STATIQUE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_STATIQUE).then(async (cache) => {
        const enCache = await cache.match(req);
        if (enCache) return enCache;
        const rep = await fetch(req);
        if (rep.ok) cache.put(req, rep.clone());
        return rep;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(PAGE_HORS_LIGNE)));
  }
});
