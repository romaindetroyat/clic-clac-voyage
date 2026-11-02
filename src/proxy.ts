import { NextResponse, type NextRequest } from "next/server";

/**
 * Lien secret de lecteur : /v/<slug>?cle=<jeton>
 * Le jeton passe dans un cookie httpOnly limité au site du voyage, puis on redirige
 * vers l'adresse propre (le jeton ne reste ni dans la barre d'adresse ni dans l'historique).
 */
export function proxy(req: NextRequest) {
  const cle = req.nextUrl.searchParams.get("cle");
  if (!cle) return NextResponse.next();
  const propre = req.nextUrl.clone();
  propre.searchParams.delete("cle");
  const rep = NextResponse.redirect(propre);
  rep.cookies.set("cc_lecteur", cle, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: req.nextUrl.pathname,
    maxAge: 60 * 60 * 24 * 365,
  });
  return rep;
}

export const config = { matcher: "/v/:slug" };
