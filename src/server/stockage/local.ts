import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { signatureValide, signer } from "../domaine/crypto";
import { debutDuJourUtc, DUREE_URL_STABLE, type Morceau, type Stockage } from "./types";

/**
 * Imitation de R2 sur le disque, pour le développement et les tests (jamais en production).
 * Les « URL signées » pointent vers /api/stockage-local avec un jeton HMAC à durée limitée,
 * ce qui reproduit fidèlement le parcours du navigateur (PUT direct, ETag, reprise).
 */
export type OperationLocale =
  | { op: "envoi"; cle: string; exp: number }
  | { op: "morceau"; cle: string; envoiId: string; numero: number; exp: number }
  | { op: "lecture"; cle: string; exp: number; nom?: string };

export class StockageLocal implements Stockage {
  constructor(
    private dossier: string,
    private baseUrl: string,
    private secret: string,
  ) {}

  private chemin(cle: string) {
    const p = path.resolve(this.dossier, "objets", cle);
    if (!p.startsWith(path.resolve(this.dossier))) throw new Error("Clé invalide");
    return p;
  }

  private dossierEnvoi(envoiId: string) {
    if (!/^[0-9a-f-]{36}$/.test(envoiId)) throw new Error("Envoi invalide");
    return path.join(this.dossier, "envois", envoiId);
  }

  jeton(o: OperationLocale): string {
    const corps = Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${corps}.${signer(corps, this.secret)}`;
  }

  lireJeton(j: string): OperationLocale | null {
    const [corps, sig] = j.split(".");
    if (!corps || !sig || !/^[0-9a-f]+$/.test(sig) || !signatureValide(corps, sig, this.secret)) return null;
    const o = JSON.parse(Buffer.from(corps, "base64url").toString()) as OperationLocale;
    return o.exp > Date.now() ? o : null;
  }

  private url(o: OperationLocale) {
    return `${this.baseUrl}/api/stockage-local?j=${this.jeton(o)}`;
  }

  async urlEnvoi(cle: string) {
    return this.url({ op: "envoi", cle, exp: Date.now() + 3600_000 });
  }

  async creerMultipart() {
    const id = randomUUID();
    await mkdir(this.dossierEnvoi(id), { recursive: true });
    return id;
  }

  async urlMorceau(cle: string, envoiId: string, numero: number) {
    return this.url({ op: "morceau", cle, envoiId, numero, exp: Date.now() + 6 * 3600_000 });
  }

  async listerMorceaux(_cle: string, envoiId: string): Promise<Morceau[]> {
    const fichiers = await readdir(this.dossierEnvoi(envoiId)).catch(() => []);
    const res: Morceau[] = [];
    for (const f of fichiers.filter((f) => f.endsWith(".part"))) {
      const contenu = await readFile(path.join(this.dossierEnvoi(envoiId), f));
      res.push({ numero: Number(f.replace(".part", "")), etag: etag(contenu) });
    }
    return res.sort((a, b) => a.numero - b.numero);
  }

  async terminerMultipart(cle: string, envoiId: string, morceaux: Morceau[]) {
    const recus = new Map((await this.listerMorceaux(cle, envoiId)).map((m) => [m.numero, m.etag]));
    const cible = this.chemin(cle);
    await mkdir(path.dirname(cible), { recursive: true });
    await writeFile(cible, Buffer.alloc(0));
    for (const m of [...morceaux].sort((a, b) => a.numero - b.numero)) {
      if (recus.get(m.numero) !== m.etag) throw new Error(`Morceau ${m.numero} manquant ou différent`);
      await appendFile(cible, await readFile(path.join(this.dossierEnvoi(envoiId), `${m.numero}.part`)));
    }
    await rm(this.dossierEnvoi(envoiId), { recursive: true, force: true });
  }

  async annulerMultipart(_cle: string, envoiId: string) {
    await rm(this.dossierEnvoi(envoiId), { recursive: true, force: true });
  }

  async urlLecture(cle: string, dureeSecondes: number, nom?: string) {
    return this.url({ op: "lecture", cle, exp: Date.now() + dureeSecondes * 1000, nom });
  }

  async urlLectureStable(cle: string) {
    return this.url({ op: "lecture", cle, exp: debutDuJourUtc().getTime() + DUREE_URL_STABLE * 1000 });
  }

  async taille(cle: string) {
    return stat(this.chemin(cle)).then((s) => s.size, () => null);
  }

  async supprimer(clesASupprimer: string[]) {
    await Promise.all(clesASupprimer.map((c) => rm(this.chemin(c), { force: true })));
  }

  async lire(cle: string) {
    return new Uint8Array(await readFile(this.chemin(cle)));
  }

  // Le type MIME ne sert pas en local : les fichiers sont servis selon leur usage.
  async ecrire(cle: string, contenu: Uint8Array) {
    const cible = this.chemin(cle);
    await mkdir(path.dirname(cible), { recursive: true });
    await writeFile(cible, contenu);
  }

  /* Utilisé par la route /api/stockage-local */
  async ecrireSigne(o: OperationLocale, contenu: Buffer): Promise<string> {
    if (o.op === "envoi") {
      const cible = this.chemin(o.cle);
      await mkdir(path.dirname(cible), { recursive: true });
      await writeFile(cible, contenu);
    } else if (o.op === "morceau") {
      const d = this.dossierEnvoi(o.envoiId);
      await mkdir(d, { recursive: true });
      await writeFile(path.join(d, `${o.numero}.part`), contenu);
    } else {
      throw new Error("Opération non autorisée");
    }
    return etag(contenu);
  }

  async lireSigne(o: OperationLocale): Promise<Buffer | null> {
    if (o.op !== "lecture") return null;
    return readFile(this.chemin(o.cle)).catch(() => null);
  }
}

function etag(b: Buffer) {
  return `"${createHash("md5").update(b).digest("hex")}"`;
}
