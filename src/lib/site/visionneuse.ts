/**
 * Visionneuse plein écran du site, en JavaScript sans dépendance.
 * La même fonction sert au site en ligne et, recopiée telle quelle (toString), à l'export .zip :
 * elle ne doit donc rien utiliser en dehors de son propre corps.
 *
 * Balisage attendu : des éléments [data-media="<id>"] regroupés dans des [data-groupe],
 * et un <script type="application/json" id="donnees-visionneuse"> avec { fuseau, medias }.
 */
export function installerVisionneuse(doc: Document) {
  type M = {
    type: "photo" | "video";
    urls: Partial<Record<"s" | "m" | "l" | "affiche" | "video", string>>;
    legende: string | null;
    auteur: string | null;
    instant: string | null;
    reactions: { emoji: string; nb: number }[];
    commentaires: { auteur: string; texte: string }[];
  };
  const brut = doc.getElementById("donnees-visionneuse")?.textContent;
  if (!brut) return () => {};
  const donnees = JSON.parse(brut) as { fuseau: string; medias: Record<string, M> };
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: donnees.fuseau,
  });

  let ids: string[] = [];
  let i = 0;
  let racine: HTMLDivElement | null = null;
  let retourFocus: HTMLElement | null = null;
  let debut: { x: number; y: number } | null = null;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texte?: string) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (texte != null) e.textContent = texte;
    return e;
  }

  function afficher() {
    if (!racine) return;
    const id = ids[i];
    const m = donnees.medias[id];
    const scene = racine.querySelector(".sv-scene")!;
    const bas = racine.querySelector(".sv-bas")!;
    scene.querySelector("img, video")?.remove();
    if (m.type === "video" && m.urls.video) {
      const v = el("video");
      v.src = m.urls.video;
      if (m.urls.affiche) v.poster = m.urls.affiche;
      v.controls = true;
      v.playsInline = true;
      scene.prepend(v);
    } else {
      const img = el("img");
      img.src = m.urls.l ?? m.urls.m ?? m.urls.affiche ?? "";
      img.alt = m.legende ?? "";
      scene.prepend(img);
    }
    (racine.querySelector(".sv-prec") as HTMLElement).hidden = i === 0;
    (racine.querySelector(".sv-suiv") as HTMLElement).hidden = i === ids.length - 1;
    racine.querySelector(".sv-compte")!.textContent = `${i + 1} / ${ids.length}`;

    bas.replaceChildren();
    if (m.legende) bas.append(el("p", "sv-legende", m.legende));
    const meta = [m.instant ? fmt.format(new Date(m.instant)) : null, m.auteur].filter(Boolean).join(" · ");
    if (meta) bas.append(el("p", "sv-meta", meta.charAt(0).toUpperCase() + meta.slice(1)));
    if (m.reactions.length) bas.append(el("p", "sv-reac", m.reactions.map((r) => `${r.emoji} ${r.nb}`).join("   ")));
    if (m.commentaires.length) {
      const ul = el("ul", "sv-coms");
      for (const c of m.commentaires) {
        const li = el("li");
        li.append(el("strong", undefined, c.auteur), doc.createTextNode(` ${c.texte}`));
        ul.append(li);
      }
      bas.append(ul);
    }
    // Précharge la suivante pour un balayage fluide.
    const suivant = donnees.medias[ids[i + 1]];
    if (suivant?.type === "photo" && (suivant.urls.l ?? suivant.urls.m)) new Image().src = (suivant.urls.l ?? suivant.urls.m)!;
  }

  function aller(sens: number) {
    const j = i + sens;
    if (j < 0 || j >= ids.length) return;
    i = j;
    afficher();
  }

  function fermer(depuisHistorique = false) {
    if (!racine) return;
    racine.remove();
    racine = null;
    doc.documentElement.style.overflow = "";
    doc.removeEventListener("keydown", clavier);
    retourFocus?.focus();
    if (!depuisHistorique && history.state && history.state.visionneuse) history.back();
  }

  function clavier(e: KeyboardEvent) {
    if (e.key === "ArrowRight") aller(1);
    else if (e.key === "ArrowLeft") aller(-1);
    else if (e.key === "Escape") fermer();
  }

  function ouvrir(cible: HTMLElement) {
    const groupe = cible.closest("[data-groupe]") ?? doc.body;
    ids = [...new Set([...groupe.querySelectorAll<HTMLElement>("[data-media]")].map((x) => x.dataset.media!))].filter(
      (x) => donnees.medias[x],
    );
    i = Math.max(0, ids.indexOf(cible.dataset.media!));
    retourFocus = cible;

    racine = el("div", "sv");
    racine.setAttribute("role", "dialog");
    racine.setAttribute("aria-modal", "true");
    racine.setAttribute("aria-label", "Visionneuse");
    const haut = el("div", "sv-haut");
    const compte = el("span", "sv-compte");
    const fermerBtn = el("button", "sv-fermer", "Fermer");
    fermerBtn.type = "button";
    fermerBtn.onclick = () => fermer();
    haut.append(compte, fermerBtn);
    const scene = el("div", "sv-scene");
    const prec = el("button", "sv-fleche sv-prec", "‹");
    prec.type = "button";
    prec.setAttribute("aria-label", "Photo précédente");
    prec.onclick = () => aller(-1);
    const suiv = el("button", "sv-fleche sv-suiv", "›");
    suiv.type = "button";
    suiv.setAttribute("aria-label", "Photo suivante");
    suiv.onclick = () => aller(1);
    scene.append(prec, suiv);
    scene.addEventListener("touchstart", (e) => (debut = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true });
    scene.addEventListener("touchend", (e) => {
      if (!debut) return;
      const dx = e.changedTouches[0].clientX - debut.x;
      const dy = e.changedTouches[0].clientY - debut.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) aller(dx < 0 ? 1 : -1);
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) fermer();
      debut = null;
    });
    racine.append(haut, scene, el("div", "sv-bas"));
    doc.body.append(racine);
    doc.documentElement.style.overflow = "hidden";
    doc.addEventListener("keydown", clavier);
    // Le bouton « retour » du téléphone ferme la visionneuse au lieu de quitter le site.
    history.pushState({ visionneuse: true }, "");
    afficher();
    fermerBtn.focus();
  }

  function clic(e: MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const cible = (e.target as HTMLElement).closest<HTMLElement>("[data-media]");
    if (!cible) return;
    e.preventDefault();
    ouvrir(cible);
  }
  function retour() {
    if (racine) fermer(true);
  }

  doc.addEventListener("click", clic);
  window.addEventListener("popstate", retour);
  return () => {
    doc.removeEventListener("click", clic);
    window.removeEventListener("popstate", retour);
    fermer(true);
  };
}
