import { AwsClient } from "aws4fetch";
import type { Morceau, Stockage } from "./types";

/** Cloudflare R2 par son API compatible S3, signée avec aws4fetch (léger, sans SDK AWS). */
export class StockageR2 implements Stockage {
  private client: AwsClient;
  private base: string;

  constructor(o: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new AwsClient({
      accessKeyId: o.accessKeyId,
      secretAccessKey: o.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    this.base = `https://${o.accountId}.r2.cloudflarestorage.com/${o.bucket}`;
  }

  private url(cle: string, params: Record<string, string> = {}) {
    const u = new URL(`${this.base}/${cle.split("/").map(encodeURIComponent).join("/")}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u;
  }

  private async signer(u: URL, method: string, duree = 3600, headers?: Record<string, string>) {
    u.searchParams.set("X-Amz-Expires", String(duree));
    const req = await this.client.sign(u.toString(), { method, headers, aws: { signQuery: true } });
    return req.url;
  }

  private async appel(u: URL, init: RequestInit = {}) {
    const rep = await this.client.fetch(u.toString(), init);
    if (!rep.ok) throw new Error(`R2 ${init.method ?? "GET"} ${rep.status}`);
    return rep;
  }

  urlEnvoi(cle: string) {
    return this.signer(this.url(cle), "PUT");
  }

  async creerMultipart(cle: string, typeMime: string) {
    const rep = await this.appel(this.url(cle, { uploads: "" }), { method: "POST", headers: { "content-type": typeMime } });
    const xml = await rep.text();
    const id = /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1];
    if (!id) throw new Error("R2 : identifiant d'envoi absent");
    return id;
  }

  urlMorceau(cle: string, envoiId: string, numero: number) {
    return this.signer(this.url(cle, { partNumber: String(numero), uploadId: envoiId }), "PUT", 6 * 3600);
  }

  async listerMorceaux(cle: string, envoiId: string): Promise<Morceau[]> {
    const morceaux: Morceau[] = [];
    let marqueur = "0";
    for (;;) {
      const rep = await this.appel(this.url(cle, { uploadId: envoiId, "max-parts": "1000", "part-number-marker": marqueur }));
      const xml = await rep.text();
      for (const m of xml.matchAll(/<Part>[\s\S]*?<PartNumber>(\d+)<\/PartNumber>[\s\S]*?<ETag>([^<]+)<\/ETag>[\s\S]*?<\/Part>/g)) {
        morceaux.push({ numero: Number(m[1]), etag: m[2].replace(/&quot;/g, '"') });
      }
      if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break;
      marqueur = /<NextPartNumberMarker>(\d+)<\/NextPartNumberMarker>/.exec(xml)?.[1] ?? "";
      if (!marqueur) break;
    }
    return morceaux;
  }

  async terminerMultipart(cle: string, envoiId: string, morceaux: Morceau[]) {
    const corps = `<CompleteMultipartUpload>${[...morceaux]
      .sort((a, b) => a.numero - b.numero)
      .map((m) => `<Part><PartNumber>${m.numero}</PartNumber><ETag>${m.etag.replace(/"/g, "&quot;")}</ETag></Part>`)
      .join("")}</CompleteMultipartUpload>`;
    const rep = await this.appel(this.url(cle, { uploadId: envoiId }), { method: "POST", body: corps });
    const xml = await rep.text();
    if (xml.includes("<Error>")) throw new Error("R2 : échec de l'assemblage des morceaux");
  }

  async annulerMultipart(cle: string, envoiId: string) {
    await this.client.fetch(this.url(cle, { uploadId: envoiId }).toString(), { method: "DELETE" });
  }

  urlLecture(cle: string, dureeSecondes: number, nomTelechargement?: string) {
    const params: Record<string, string> = {};
    if (nomTelechargement) {
      params["response-content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(nomTelechargement)}`;
    }
    return this.signer(this.url(cle, params), "GET", dureeSecondes);
  }

  async taille(cle: string) {
    const rep = await this.client.fetch(this.url(cle).toString(), { method: "HEAD" });
    if (rep.status === 404) return null;
    if (!rep.ok) throw new Error(`R2 HEAD ${rep.status}`);
    return Number(rep.headers.get("content-length") ?? 0);
  }

  async supprimer(clesASupprimer: string[]) {
    // Suppression groupée S3 par lots de 1000 clés.
    for (let i = 0; i < clesASupprimer.length; i += 1000) {
      const lot = clesASupprimer.slice(i, i + 1000);
      const corps = `<Delete><Quiet>true</Quiet>${lot.map((c) => `<Object><Key>${c}</Key></Object>`).join("")}</Delete>`;
      const md5 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(corps));
      await this.appel(this.url("", { delete: "" }), {
        method: "POST",
        body: corps,
        headers: { "x-amz-checksum-sha256": Buffer.from(md5).toString("base64") },
      });
    }
  }
}
