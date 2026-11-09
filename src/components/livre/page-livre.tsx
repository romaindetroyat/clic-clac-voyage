/**
 * Rendu d'une page du livre à l'écran, à n'importe quelle échelle. Géométrie et recadrage
 * viennent de src/lib/livre : l'éditeur, l'aperçu et le PDF partagent les mêmes calculs.
 */
import type { CSSProperties } from "react";
import { styleImage } from "@/lib/livre/cadrage";
import type { Format } from "@/lib/livre/formats";
import { geometriePage, texteDuCadre, type CadreTexte, type Forme, type Rect } from "@/lib/livre/gabarits";
import { ratiosDe, type MediaLivre, type PageLivre } from "@/lib/livre/modele";
import { couleursDe, interligne, POLICES, styleTypo, teinte, type Couleurs, type StyleTypo } from "@/lib/livre/styles";

const PT = 0.3528;

export { FONDS } from "@/lib/livre/styles";

/** Style CSS d'un texte du livre (mêmes polices, tailles et couleurs que le PDF). */
export function styleTexte(st: StyleTypo, t: Pick<CadreTexte, "role" | "echelle" | "teinte">, couleurs: Couleurs, mmEnPx: number): CSSProperties {
  const typo = st[t.role];
  const couleur = t.teinte === "clair" ? "#ffffff" : t.teinte === "accent" ? couleurs.accent : typo.couleur === "douce" ? couleurs.douce : typo.couleur === "accent" ? couleurs.accent : couleurs.encre;
  return {
    fontFamily: `${POLICES[typo.police].css}, Georgia, serif`,
    fontSize: Math.max(typo.taille * (t.echelle ?? 1) * PT * mmEnPx, 1),
    lineHeight: interligne(typo, t.role),
    fontStyle: typo.italique ? "italic" : "normal",
    textTransform: typo.majuscules ? "uppercase" : "none",
    letterSpacing: typo.suivi ? `${typo.suivi}em` : "normal",
    color: couleur,
  };
}

export function PageVue({
  page,
  numero,
  format,
  fond,
  style,
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
  /** Fond du livre (celui de la page l'emporte). */
  fond: string;
  /** Style typographique du livre. */
  style?: string;
  medias: Map<string, MediaLivre>;
  /** Largeur affichée en pixels. */
  largeur: number;
  selection?: { cellule: number | null } | null;
  onCellule?: (i: number) => void;
  onPage?: () => void;
  className?: string;
}) {
  const s = largeur / format.largeur; // pixels par millimètre
  const geo = geometriePage(format, page.gabarit, numero, ratiosDe(page.cellules, (id) => medias.get(id)));
  const couleurs = couleursDe(page.fond ?? fond);
  const st = styleTypo(style);
  const px = (mm: number) => mm * s;
  const pos = (r: Rect, rotation?: number): CSSProperties => ({
    position: "absolute",
    left: px(r.x),
    top: px(r.y),
    width: px(r.l),
    height: px(r.h),
    ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
  });
  const forme = (f: Forme, i: number) => (
    <div
      key={`f${i}`}
      aria-hidden
      style={{
        ...pos(f.rect, f.rotation),
        opacity: f.opacite ?? 1,
        ...(f.trait ? { border: `${Math.max(0.5, px(f.trait))}px solid ${teinte(couleurs, f.teinte)}` } : { background: teinte(couleurs, f.teinte) }),
        pointerEvents: "none",
      }}
    />
  );
  const texte = (t: CadreTexte, i: number) => {
    const contenu = texteDuCadre(page, t, numero);
    if (!contenu) return null;
    const style: CSSProperties = {
      ...pos(t.rect, t.rotation),
      ...styleTexte(st, t, couleurs, s),
      overflow: "hidden",
      textAlign: t.centre ? "center" : t.droite ? "right" : "left",
      whiteSpace: t.role === "corps" ? "pre-line" : "normal",
      ...(t.bas || t.milieu ? { display: "flex", flexDirection: "column", justifyContent: t.bas ? "flex-end" : "center" } : {}),
      pointerEvents: "none",
    };
    return (
      <div key={`t${i}`} style={style} data-role={t.role}>
        {t.bas || t.milieu ? <span>{contenu}</span> : contenu}
      </div>
    );
  };

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${onPage ? "cursor-pointer" : ""} ${className}`}
      style={{ width: largeur, height: px(format.hauteur), background: couleurs.fond, color: couleurs.encre }}
      onClick={onPage}
      data-page={numero}
    >
      {geo.formes.filter((f) => !f.dessus).map(forme)}
      {geo.photos.map((cadre, i) => {
        const c = page.cellules[i];
        const m = c ? medias.get(c.mediaId) : undefined;
        const choisie = selection?.cellule === i;
        return (
          <div
            key={i}
            style={pos(cadre, cadre.rotation)}
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
      {geo.textes.filter((t) => !t.dessus).map(texte)}
      {geo.formes.filter((f) => f.dessus).map(forme)}
      {geo.textes.filter((t) => t.dessus).map(texte)}
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
