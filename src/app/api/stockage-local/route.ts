import { NextResponse, type NextRequest } from "next/server";
import { getStockageLocal } from "@/server/stockage";

/** Point d'entrée du stockage local (imitation des URL signées R2). Désactivé en production sans STOCKAGE_LOCAL. */
export async function PUT(req: NextRequest) {
  const s = getStockageLocal();
  const o = s.lireJeton(req.nextUrl.searchParams.get("j") ?? "");
  if (!o) return new NextResponse("Signature invalide ou expirée", { status: 403 });
  const etag = await s.ecrire(o, Buffer.from(await req.arrayBuffer()));
  return new NextResponse(null, { status: 200, headers: { ETag: etag } });
}

export async function GET(req: NextRequest) {
  const s = getStockageLocal();
  const o = s.lireJeton(req.nextUrl.searchParams.get("j") ?? "");
  if (!o) return new NextResponse("Signature invalide ou expirée", { status: 403 });
  const contenu = await s.lire(o);
  if (!contenu) return new NextResponse("Introuvable", { status: 404 });
  const headers: Record<string, string> = { "Cache-Control": "private, max-age=3600" };
  if (o.op === "lecture" && o.nom) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(o.nom)}`;
  return new NextResponse(new Uint8Array(contenu), { headers });
}
