/**
 * Rendu d'une page du livre à l'écran, à n'importe quelle échelle. Géométrie et recadrage
 * viennent de src/lib/livre : l'éditeur, l'aperçu et le PDF partagent les mêmes calculs.
 */
import type { CSSProperties } from "react";
import { styleImage } from "@/lib/livre/cadrage";
import { TAILLES } from "@/lib/livre/controles";
import type { Format } from "@/lib/livre/formats";
import { geometriePage, type CadreTexte } from "@/lib/livre/gabarits";
import { FONDS, type MediaLivre, type PageLivre } from "@/lib/livre/modele";

const PT = 0.3528;

export { FONDS };

function texteDe(p: PageLivre, t: CadreTexte, numero: number): string {
  switch (t.role) {
    case "titre":
      return p.titre ?? "";
    case "surtitre":
      return p.surtitre ?? "";
    case "corps":
      return p.corps ?? "";
    case "legende":
      return p.legende ?? "";
    case "folio":
      return String(numero);
  }
}

export function PageVue({
  page,
  numero,
  format,
  fond,
  medias,
  largeur,
  selection,
  onCellule,
  onPage,
  className = "",
}: {
  page: PageLivre;
  numero: number;
  format: Format;
  fond: keyof typeof FONDS;
  medias: Map<string, MediaLivre>;
  /** Largeur affichée en pixels. */
  largeur: number;
  selection?: { cellule: number | null } | null;
  onCellule?: (i: number) => void;
  onPage?: () => void;
  className?: string;
}) {
  const s = largeur / format.largeur; // pixels par millimètre
  const geo = geometriePage(format, page.gabarit, numero);
  const couleurs = FONDS[fond];
  const px = (mm: number) => mm * s;
  const pos = (r: { x: number; y: number; l: number; h: number }): CSSProperties => ({
    position: "absolute",
    left: px(r.x),
    top: px(r.y),
    width: px(r.l),
    height: px(r.h),
  });

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${onPage ? "cursor-pointer" : ""} ${className}`}
      style={{ width: largeur, height: px(format.hauteur), background: couleurs.fond, color: couleurs.encre }}
      onClick={onPage}
      data-page={numero}
    >
      {geo.photos.map((cadre, i) => {
        const c = page.cellules[i];
        const m = c ? medias.get(c.mediaId) : undefined;
        const choisie = selection?.cellule === i;
        return (
          <div
            key={i}
            style={pos(cadre)}
            className={`overflow-hidden ${onCellule ? "cursor-pointer" : ""} ${choisie ? "z-10 outline outline-2 outline-offset-[-2px] outline-[#2f7cf6]" : ""}`}
            onClick={
              onCellule
                ? (e) => {
                    e.stopPropagation();
                    onCellule(i);
                  }
                : undefined
            }
            data-cellule={i}
          >
            {c && m && (m.moyenne || m.vignette) ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
              <img
                src={(largeur > 260 ? m.moyenne : m.vignette) ?? m.vignette ?? m.moyenne ?? ""}
                alt=""
                draggable={false}
                loading="lazy"
                className="absolute max-w-none select-none"
                style={styleImage(m.largeur, m.hauteur, cadre.l / cadre.h, c)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center border border-dashed" style={{ borderColor: couleurs.douce, color: couleurs.douce, fontSize: Math.max(9, px(3)) }}>
                {c ? "Photo absente" : "Cadre vide"}
              </div>
            )}
          </div>
        );
      })}
      {geo.textes.map((t, i) => {
        const texte = texteDe(page, t, numero);
        if (!texte) return null;
        const taille = Math.max(px(TAILLES[t.role] * PT), 1);
        const style: CSSProperties = {
          ...pos(t.rect),
          fontSize: taille,
          lineHeight: t.role === "corps" ? 1.45 : 1.2,
          overflow: "hidden",
          textAlign: t.centre ? "center" : "left",
          whiteSpace: t.role === "corps" ? "pre-line" : "normal",
        };
        if (t.role === "titre" || t.role === "corps") style.fontFamily = "var(--font-titre), Georgia, serif";
        if (t.role === "surtitre") Object.assign(style, { textTransform: "uppercase", letterSpacing: "0.12em", color: couleurs.douce });
        if (t.role === "legende" || t.role === "folio") style.color = couleurs.douce;
        return (
          <div key={i} style={style}>
            {texte}
          </div>
        );
      })}
    </div>
  );
}

/** Pages groupées en doubles pages : la page 1 seule à droite, puis (2, 3), (4, 5)… */
export function doublesPages(n: number): (number | null)[][] {
  const r: (number | null)[][] = [[null, 0]];
  for (let i = 1; i < n; i += 2) r.push([i, i + 1 < n ? i + 1 : null]);
  return r;
}

/** Première de couverture, rendue comme une page (titre, sous-titre, photo). */
export function pageDeCouverture(c: { titre: string; sousTitre: string; photo: PageLivre["cellules"][number] }): PageLivre {
  return { id: "couverture", gabarit: "couverture", cellules: [c.photo], titre: c.titre, surtitre: c.sousTitre };
}
