import { NextResponse, type NextRequest } from "next/server";

/**
 * Normalement intercepté par le service worker. Si celui-ci n'est pas encore actif
 * (tout premier partage), on renvoie vers la page de partage avec une explication.
 */
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/partager?erreur=premier", req.url), 303);
}
