/**
 * Manifeste du site d'un voyage : une fois installé, l'icône ouvre le site, pas l'app.
 * Aucune lecture en base : le navigateur ne transmet pas les cookies au manifeste,
 * et on ne révèle rien de plus que l'adresse, déjà connue de qui la demande.
 */
export async function GET(_: Request, ctx: RouteContext<"/v/[slug]/manifest.webmanifest">) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new Response("Introuvable", { status: 404 });
  const nom = slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const manifeste = {
    name: nom,
    short_name: nom.length > 12 ? nom.slice(0, 12) : nom,
    lang: "fr",
    start_url: `/v/${slug}`,
    scope: `/v/${slug}`,
    id: `/v/${slug}`,
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#1d1b18",
    icons: [
      { src: "/icones/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifeste), {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=86400" },
  });
}
