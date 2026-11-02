import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

export function genererId(): string {
  return randomUUID();
}

/** Jeton aléatoire de 256 bits, encodé pour une URL. */
export function genererJeton(): string {
  return randomBytes(32).toString("base64url");
}

export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function scryptAsync(motDePasse: string, sel: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(motDePasse, sel, 32, { N: 16384, r: 8, p: 1 }, (err, cle) => (err ? reject(err) : resolve(cle))),
  );
}

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16);
  const cle = await scryptAsync(motDePasse, sel);
  return `scrypt$${sel.toString("hex")}$${cle.toString("hex")}`;
}

export async function verifierMotDePasse(motDePasse: string, stocke: string): Promise<boolean> {
  const [algo, selHex, cleHex] = stocke.split("$");
  if (algo !== "scrypt" || !selHex || !cleHex) return false;
  const attendu = Buffer.from(cleHex, "hex");
  const obtenu = await scryptAsync(motDePasse, Buffer.from(selHex, "hex"));
  return attendu.length === obtenu.length && timingSafeEqual(attendu, obtenu);
}

/** Signature HMAC-SHA256 (hex) d'une valeur, avec le secret de l'app. */
export function signer(valeur: string, secret: string): string {
  return createHmac("sha256", secret).update(valeur).digest("hex");
}

export function signatureValide(valeur: string, signature: string, secret: string): boolean {
  const attendu = Buffer.from(signer(valeur, secret), "hex");
  const recu = Buffer.from(signature, "hex");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}
