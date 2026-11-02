/*
 * Service worker de Clic-Clac Voyage.
 * - met en cache la page « hors ligne » et les ressources statiques de Next ;
 * - réseau d'abord pour les pages, avec repli sur la page hors ligne ;
 * - site d'un voyage (/v/<slug>) : la page et ses images restent lisibles hors ligne
 *   une fois vues (ou toutes, avec « Garder ce site pour le lire hors ligne »).
 * - reçoit les fichiers partagés depuis Android (Web Share Target) et les garde dans IndexedDB
 *   jusqu'à ce que la page /partager les ajoute à la file d'envoi du bon voyage.
 */
// Changer ce numéro fait installer la nouvelle version du service worker.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VERSION = "v3";
// Fichiers de Next (noms uniques par version) : gardés d'un déploiement à l'autre,
// sinon une page du site gardée hors ligne perdrait ses styles après une mise à jour.
const CACHE_STATIQUE = "statique";
// Caches du site : conservés d'une version du service worker à l'autre.
const CACHE_SITE = "site-pages";
const CACHE_MEDIAS = "site-medias";
const UN_JOUR = 86400_000;
const PAGE_HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_STATIQUE).then((c) => c.addAll([PAGE_HORS_LIGNE, "/icones/192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(
          cles.filter((c) => ![CACHE_STATIQUE, CACHE_SITE, CACHE_MEDIAS].includes(c)).map((c) => caches.delete(c)),
        ),
      )
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

/** Image ou vidéo du site : la route renvoie vers une URL signée du stockage (CORS autorisé). */
async function chargerMedia(url) {
  try {
    const rep = await fetch(url, { mode: "cors", credentials: "same-origin" });
    if (!rep.ok) return rep;
    // On garde la date de mise en cache pour rafraîchir au plus une fois par jour.
    const corps = await rep.blob();
    const entetes = new Headers(rep.headers);
    entetes.set("x-cc-le", String(Date.now()));
    return new Response(corps, { status: 200, headers: entetes });
  } catch {
    // Stockage sans CORS pour cette origine (prévisualisation) : lecture simple, sans cache.
    return null;
  }
}

async function media(req) {
  const cache = await caches.open(CACHE_MEDIAS);
  const enCache = await cache.match(req.url);
  if (enCache) {
    const le = Number(enCache.headers.get("x-cc-le") ?? 0);
    if (Date.now() - le > UN_JOUR && navigator.onLine) {
      chargerMedia(req.url).then((r) => r && r.ok && cache.put(req.url, r));
    }
    return enCache;
  }
  const rep = await chargerMedia(req.url);
  if (!rep) return fetch(req);
  if (rep.ok) await cache.put(req.url, rep.clone());
  return rep;
}

async function pageSite(req) {
  const cache = await caches.open(CACHE_SITE);
  try {
    const rep = await fetch(req);
    if (rep.ok) await cache.put(new URL(req.url).pathname, rep.clone());
    return rep;
  } catch {
    return (await cache.match(new URL(req.url).pathname)) ?? caches.match(PAGE_HORS_LIGNE);
  }
}

/** « Garder ce site pour le lire hors ligne » : la page et toutes ses images. */
async function garderHorsLigne(urls, port) {
  const [pages, medias] = await Promise.all([caches.open(CACHE_SITE), caches.open(CACHE_MEDIAS)]);
  let fait = 0;
  const file = [...new Set(urls)];
  const total = file.length;
  async function suivant() {
    for (;;) {
      const url = file.shift();
      if (!url) return;
      try {
        if (url.includes("/m/")) {
          if (!(await medias.match(url))) {
            const r = await chargerMedia(url);
            if (r && r.ok) await medias.put(url, r);
          }
        } else {
          const r = await fetch(url, { credentials: "same-origin" });
          if (r.ok) await pages.put(url, r);
        }
      } catch {
        /* on continue : une image manquante n'empêche pas les autres */
      }
      fait++;
      if (fait % 5 === 0 || fait === total) port.postMessage({ fait, total });
    }
  }
  await Promise.all([suivant(), suivant(), suivant(), suivant()]);
  port.postMessage({ fait, total, fini: true });
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "garder-hors-ligne" && event.ports[0]) {
    event.waitUntil(garderHorsLigne(event.data.urls ?? [], event.ports[0]));
  }
});

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

  if (/^\/v\/[^/]+\/m\//.test(url.pathname)) {
    event.respondWith(media(req));
    return;
  }
  if (req.mode === "navigate" && /^\/v\/[^/]+\/?$/.test(url.pathname) && !url.search) {
    event.respondWith(pageSite(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(PAGE_HORS_LIGNE)));
  }
});
