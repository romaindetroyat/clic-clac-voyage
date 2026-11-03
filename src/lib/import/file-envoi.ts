"use client";

/**
 * File d'envoi persistante.
 * - Chaque fichier choisi est copié dans IndexedDB : si l'app est fermée ou le réseau coupe,
 *   l'envoi reprend à la réouverture, au morceau près (les morceaux reçus sont relus sur R2).
 * - Analyse (empreintes, EXIF, versions web) dans un Web Worker pour les photos.
 * - Envoi direct au stockage par URL signée, plusieurs fichiers et morceaux en parallèle.
 */
import { openDB, type IDBPDatabase } from "idb";
import { analyserVideo } from "./video";
import { typeDeFichier, type Analyse } from "./types";

export type EtatElement = "attente" | "analyse" | "envoi" | "termine" | "doublon" | "erreur";
type Morceau = { numero: number; etag: string };

export type Element = {
  id: string;
  voyage: string;
  nom: string;
  taille: number;
  type: "photo" | "video";
  source: string;
  copieCompressee: boolean;
  ajouteLe: number;
  etat: EtatElement;
  progression: number;
  erreur?: string;
  avertissement?: string;
  fichier?: Blob;
  analyse?: Omit<Analyse, "versions">;
  versions?: Analyse["versions"];
  mediaId?: string;
  morceaux?: Morceau[];
  tentatives?: number;
  /** Date imposée (ex. heure du message WhatsApp) quand le fichier n'en contient pas. */
  priseImposee?: string;
  /** Pas de nouvel essai avant cet instant (ms). */
  prochainEssai?: number;
  /** Envoyer même en économie de données (choix explicite). */
  forcer?: boolean;
};

const BASE = "clic-clac-envois";
const MAGASIN = "elements";
const ENVOIS_PARALLELES = 3;
/** En mode économie de données, les fichiers plus gros attendent le Wi-Fi. */
export const SEUIL_ECONOMIE = 5 * 1024 * 1024;
const CLE_ECONOMIE = "clic-clac:economie-donnees";

type Connexion = { type?: string; saveData?: boolean; addEventListener?: (t: string, f: () => void) => void };
function connexion(): Connexion | undefined {
  return typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: Connexion }).connection : undefined;
}

/** Réseau mobile connu, ou économie demandée par le système ; sur iPhone le type de réseau est inconnu. */
export function reseauMobile(): boolean {
  const c = connexion();
  return c?.type === "cellular" || c?.saveData === true;
}

export function economieDonnees(): boolean {
  try {
    return localStorage.getItem(CLE_ECONOMIE) === "1";
  } catch {
    return false;
  }
}
const MORCEAUX_PARALLELES = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;
function base() {
  dbPromise ??= openDB(BASE, 1, {
    upgrade(db) {
      const s = db.createObjectStore(MAGASIN, { keyPath: "id" });
      s.createIndex("voyage", "voyage");
    },
  });
  return dbPromise;
}

class ErreurDefinitive extends Error {}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const rep = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (rep.ok) return rep.json() as Promise<T>;
  const corps = (await rep.json().catch(() => ({}))) as { erreur?: string };
  if (rep.status >= 400 && rep.status < 500 && rep.status !== 408 && rep.status !== 429) {
    throw new ErreurDefinitive(corps.erreur ?? `Refusé (${rep.status})`);
  }
  throw new Error(corps.erreur ?? `Erreur serveur (${rep.status})`);
}

/** PUT avec progression ; renvoie l'ETag (nécessaire pour assembler les morceaux). */
function envoyer(url: string, corps: Blob, progression?: (octets: number) => void, signal?: AbortSignal): Promise<string> {
  return new Promise((ok, ko) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => progression?.(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) ok(xhr.getResponseHeader("ETag") ?? "");
      else if (xhr.status === 403) ko(new Error("Signature expirée"));
      else ko(new Error(`Envoi refusé (${xhr.status})`));
    };
    xhr.onerror = () => ko(new Error("Réseau indisponible"));
    xhr.ontimeout = () => ko(new Error("Délai dépassé"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(corps);
  });
}

let worker: Worker | null = null;
const attentes = new Map<string, { ok: (a: Analyse) => void; ko: (e: Error) => void; prog: (p: number) => void }>();

export function analyserDansWorker(id: string, fichier: Blob, nom: string, prog: (p: number) => void): Promise<Analyse> {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: string; resultat?: Analyse; erreur?: string; progression?: number }>) => {
      const a = attentes.get(e.data.id);
      if (!a) return;
      if (e.data.progression !== undefined) return a.prog(e.data.progression);
      attentes.delete(e.data.id);
      if (e.data.resultat) a.ok(e.data.resultat);
      else a.ko(new Error(e.data.erreur));
    };
  }
  return new Promise((ok, ko) => {
    attentes.set(id, { ok, ko, prog });
    worker!.postMessage({ id, fichier: new File([fichier], nom, { type: fichier.type }) });
  });
}

type Ecouteur = (elements: Element[]) => void;

export class FileEnvoi {
  private elements = new Map<string, Element>();
  private ecouteurs = new Set<Ecouteur>();
  private enCours = new Set<string>();
  private relance: ReturnType<typeof setTimeout> | null = null;
  private verrouEcran: WakeLockSentinel | null = null;
  private pret: Promise<void>;

  constructor(private voyage: string) {
    // Rendu serveur : rien à charger (IndexedDB n'existe que dans le navigateur).
    this.pret = typeof window === "undefined" ? Promise.resolve() : this.charger();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.reprendreMaintenant());
      connexion()?.addEventListener?.("change", () => this.pomper());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") this.pomper();
      });
    }
  }

  private async charger() {
    const db = await base();
    const tous = (await db.getAllFromIndex(MAGASIN, "voyage", this.voyage)) as Element[];
    for (const e of tous) {
      // Un envoi interrompu par la fermeture de l'app redevient « en attente ».
      if (e.etat === "analyse" || e.etat === "envoi") e.etat = "attente";
      this.elements.set(e.id, e);
    }
    this.notifier();
    this.pomper();
  }

  abonner(f: Ecouteur) {
    this.ecouteurs.add(f);
    f(this.liste());
    return () => {
      this.ecouteurs.delete(f);
    };
  }

  liste() {
    return [...this.elements.values()].sort((a, b) => a.ajouteLe - b.ajouteLe);
  }

  private notifier() {
    const l = this.liste();
    for (const f of this.ecouteurs) f(l);
  }

  private async sauver(e: Element) {
    this.elements.set(e.id, e);
    const db = await base();
    await db.put(MAGASIN, e);
    this.notifier();
  }

  /** Ajoute des fichiers à la file (copiés dans le navigateur pour survivre à une fermeture). */
  async ajouter(
    fichiers: File[],
    options: { source?: string; copieCompressee?: boolean; dates?: Map<string, string | null> } = {},
  ) {
    await this.pret;
    let ignores = 0;
    const t = Date.now();
    for (const [i, f] of fichiers.entries()) {
      const type = typeDeFichier(f);
      if (!type || f.size === 0) {
        ignores++;
        continue;
      }
      const e: Element = {
        id: crypto.randomUUID(),
        voyage: this.voyage,
        nom: f.name,
        taille: f.size,
        type,
        source: options.source ?? "fichier",
        copieCompressee: options.copieCompressee ?? false,
        ajouteLe: t + i,
        etat: "attente",
        progression: 0,
        fichier: f,
        priseImposee: options.dates?.get(f.name) ?? undefined,
      };
      await this.sauver(e);
    }
    void navigator.storage?.persist?.();
    this.pomper();
    return { ajoutes: fichiers.length - ignores, ignores };
  }

  async retirerTermines() {
    const db = await base();
    for (const e of this.liste()) {
      if (e.etat === "termine" || e.etat === "doublon") {
        this.elements.delete(e.id);
        await db.delete(MAGASIN, e.id);
      }
    }
    this.notifier();
  }

  async reessayer(id: string) {
    const e = this.elements.get(id);
    if (!e || e.etat !== "erreur") return;
    await this.sauver({ ...e, etat: "attente", erreur: undefined, tentatives: 0, prochainEssai: 0 });
    this.pomper();
  }

  async annuler(id: string) {
    const e = this.elements.get(id);
    if (!e || this.enCours.has(id)) return;
    if (e.mediaId && e.etat !== "termine") {
      await fetch(`/api/voyages/${this.voyage}/envois/${e.mediaId}`, { method: "DELETE" }).catch(() => {});
    }
    this.elements.delete(id);
    await (await base()).delete(MAGASIN, id);
    this.notifier();
  }

  /** Active ou coupe l'économie de données (les gros fichiers attendent le Wi-Fi). */
  regleEconomie(active: boolean) {
    try {
      localStorage.setItem(CLE_ECONOMIE, active ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
    this.notifier();
    this.pomper();
  }

  /** Le fichier attend-il le Wi-Fi ? */
  attendWifi(e: Element) {
    if (e.forcer || e.taille <= SEUIL_ECONOMIE || !economieDonnees()) return false;
    const c = connexion();
    // Wi-Fi ou câble connus : on envoie. Type inconnu (iPhone) : on attend un choix explicite.
    return !(c?.type === "wifi" || c?.type === "ethernet") || c?.saveData === true;
  }

  async envoyerMaintenant(id: string) {
    const e = this.elements.get(id);
    if (!e) return;
    await this.sauver({ ...e, forcer: true, prochainEssai: 0 });
    this.pomper();
  }

  async envoyerToutMaintenant() {
    for (const e of this.liste()) if (this.attendWifi(e)) await this.sauver({ ...e, forcer: true, prochainEssai: 0 });
    this.pomper();
  }

  /** Le réseau revient : on n'attend pas la fin du délai entre deux essais. */
  reprendreMaintenant() {
    for (const e of this.elements.values()) if (e.etat === "attente") e.prochainEssai = 0;
    this.pomper();
  }

  /** Lance autant d'envois que possible. */
  pomper() {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const maintenant = Date.now();
    const enAttente = this.liste().filter(
      (e) =>
        e.etat === "attente" && !this.enCours.has(e.id) && (e.prochainEssai ?? 0) <= maintenant && !this.attendWifi(e),
    );
    for (const e of enAttente.slice(0, Math.max(0, ENVOIS_PARALLELES - this.enCours.size))) {
      this.enCours.add(e.id);
      void this.traiter(e.id).finally(() => {
        this.enCours.delete(e.id);
        this.majVerrouEcran();
        this.pomper();
      });
    }
    this.majVerrouEcran();
  }

  /** Garde l'écran allumé pendant les envois (iOS n'envoie qu'au premier plan). */
  private async majVerrouEcran() {
    try {
      if (this.enCours.size > 0 && !this.verrouEcran && "wakeLock" in navigator) {
        this.verrouEcran = await navigator.wakeLock.request("screen");
        this.verrouEcran.addEventListener("release", () => (this.verrouEcran = null));
      } else if (this.enCours.size === 0 && this.verrouEcran) {
        await this.verrouEcran.release();
        this.verrouEcran = null;
      }
    } catch {
      /* non disponible : sans conséquence */
    }
  }

  private async traiter(id: string) {
    let e = this.elements.get(id)!;
    try {
      const octets = e.fichier;
      if (!octets) throw new ErreurDefinitive("Fichier perdu : ajoutez-le à nouveau.");

      // 1. Analyse
      if (!e.analyse) {
        e = { ...e, etat: "analyse", progression: 0 };
        await this.sauver(e);
        const maj = (p: number) => {
          e.progression = p;
          this.notifier();
        };
        const fichier = new File([octets], e.nom, { type: octets.type });
        const a = e.type === "photo" ? await analyserDansWorker(e.id, fichier, e.nom, maj) : await analyserVideo(fichier, maj);
        const { versions, ...reste } = a;
        e = { ...e, analyse: reste, versions, avertissement: a.avertissement };
        await this.sauver(e);
      }

      // 2. Déclaration au serveur (ou détection de doublon)
      e = { ...e, etat: "envoi", progression: 0 };
      await this.sauver(e);
      const a = e.analyse!;
      const nomsVersions = Object.keys(e.versions ?? {});
      const plan = await api<
        | { statut: "doublon"; mediaId: string }
        | {
            statut: "a-envoyer";
            mediaId: string;
            original: { mode: "simple"; url: string } | { mode: "multipart"; tailleMorceau: number; nbMorceaux: number };
            versions: Record<string, string>;
          }
      >(`/api/voyages/${this.voyage}/envois`, {
        method: "POST",
        body: JSON.stringify({
          nomFichier: e.nom,
          mime: a.mime,
          type: a.type,
          taille: e.taille,
          sha256: a.sha256,
          dhash: a.dhash,
          largeur: a.largeur,
          hauteur: a.hauteur,
          dureeSecondes: a.dureeSecondes,
          priseLocale: a.priseLocale ?? e.priseImposee ?? null,
          decalageExifMinutes: a.priseLocale ? a.decalageExifMinutes : null,
          latitude: a.latitude,
          longitude: a.longitude,
          nettete: a.nettete ?? null,
          exposition: a.exposition ?? null,
          appareil: a.appareil,
          source: e.source,
          copieCompressee: e.copieCompressee,
          versions: nomsVersions,
        }),
      });
      if (plan.statut === "doublon") {
        await this.sauver({ ...e, etat: "doublon", progression: 1, mediaId: plan.mediaId, fichier: undefined, versions: undefined });
        return;
      }
      e = { ...e, mediaId: plan.mediaId };
      await this.sauver(e);

      // 3. Versions web (petites)
      for (const [nom, url] of Object.entries(plan.versions)) {
        const v = e.versions?.[nom as keyof Analyse["versions"]];
        if (v) await envoyer(url, v);
      }

      // 4. Original
      let morceaux: Morceau[] | undefined;
      if (plan.original.mode === "simple") {
        await envoyer(plan.original.url, octets, (o) => {
          e.progression = o / e.taille;
          this.notifier();
        });
      } else {
        morceaux = await this.envoyerMorceaux(e, plan.original.tailleMorceau, plan.original.nbMorceaux);
      }

      // 5. Fin
      await api(`/api/voyages/${this.voyage}/envois/${plan.mediaId}/terminer`, {
        method: "POST",
        body: JSON.stringify({ morceaux, versions: nomsVersions }),
      });
      // Les octets ne sont plus utiles dans le navigateur.
      await this.sauver({ ...e, etat: "termine", progression: 1, fichier: undefined, versions: undefined, morceaux: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      if (err instanceof ErreurDefinitive) {
        await this.sauver({ ...e, etat: "erreur", erreur: message });
        return;
      }
      // Erreur réseau ou serveur : nouvel essai plus tard, sans limite (le voyage, c'est fait pour ça).
      const tentatives = (e.tentatives ?? 0) + 1;
      const delai = Math.min(60_000, 1000 * 2 ** Math.min(tentatives, 6));
      await this.sauver({ ...e, etat: "attente", erreur: message, tentatives, prochainEssai: Date.now() + delai });
      if (this.relance) clearTimeout(this.relance);
      this.relance = setTimeout(() => this.pomper(), delai);
    }
  }

  private async envoyerMorceaux(e: Element, tailleMorceau: number, nb: number): Promise<Morceau[]> {
    const base = `/api/voyages/${this.voyage}/envois/${e.mediaId}`;
    // Reprise : on demande au stockage ce qu'il a déjà reçu.
    const { morceaux: recus } = await api<{ morceaux: Morceau[] }>(base);
    const faits = new Map(recus.map((m) => [m.numero, m.etag]));
    const restants = Array.from({ length: nb }, (_, i) => i + 1).filter((n) => !faits.has(n));
    const enVol = new Map<number, number>();
    const majProgression = () => {
      const octetsFaits = [...faits.keys()].reduce((s, n) => s + Math.min(tailleMorceau, e.taille - (n - 1) * tailleMorceau), 0);
      const octetsEnVol = [...enVol.values()].reduce((s, o) => s + o, 0);
      e.progression = (octetsFaits + octetsEnVol) / e.taille;
      this.notifier();
    };
    majProgression();

    const lots: number[][] = [];
    for (let i = 0; i < restants.length; i += 20) lots.push(restants.slice(i, i + 20));
    for (const lot of lots) {
      const { urls } = await api<{ urls: Record<number, string> }>(`${base}/morceaux`, {
        method: "POST",
        body: JSON.stringify({ numeros: lot }),
      });
      const file = [...lot];
      const ouvriers = Array.from({ length: MORCEAUX_PARALLELES }, async () => {
        for (let n = file.shift(); n !== undefined; n = file.shift()) {
          const morceau = e.fichier!.slice((n - 1) * tailleMorceau, n * tailleMorceau);
          const etag = await envoyer(urls[n], morceau, (o) => {
            enVol.set(n!, o);
            majProgression();
          });
          enVol.delete(n);
          faits.set(n, etag);
          majProgression();
        }
      });
      await Promise.all(ouvriers);
    }
    return [...faits.entries()].map(([numero, etag]) => ({ numero, etag })).sort((a, b) => a.numero - b.numero);
  }
}

const files = new Map<string, FileEnvoi>();
export function fileEnvoi(voyage: string) {
  let f = files.get(voyage);
  if (!f) {
    f = new FileEnvoi(voyage);
    files.set(voyage, f);
  }
  return f;
}
