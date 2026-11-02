/*
 * Service worker de Clic-Clac Voyage (phase 1 : squelette).
 * - met en cache la page « hors ligne » et les ressources statiques de Next ;
 * - réseau d'abord pour les pages, avec repli sur la page hors ligne.
 * - reçoit les fichiers partagés depuis Android (Web Share Target) et les garde dans IndexedDB
 *   jusqu'à ce que la page /partager les ajoute à la file d'envoi du bon voyage.
 */
const VERSION = "v2";
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

function ouvrirPartages() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("clic-clac-partages", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("partages", { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function recevoirPartage(req) {
  try {
    const form = await req.formData();
    const fichiers = form.getAll("fichiers").filter((f) => f instanceof File && f.size > 0);
    const id = crypto.randomUUID();
    const db = await ouvrirPartages();
    await new Promise((ok, ko) => {
      const tx = db.transaction("partages", "readwrite");
      tx.objectStore("partages").put({ id, fichiers, recuLe: Date.now() });
      tx.oncomplete = ok;
      tx.onerror = () => ko(tx.error);
    });
    return Response.redirect(`/partager?id=${id}`, 303);
  } catch {
    return Response.redirect("/partager?erreur=1", 303);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method === "POST" && new URL(req.url).pathname === "/partager/recevoir") {
    event.respondWith(recevoirPartage(req));
    return;
  }
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
