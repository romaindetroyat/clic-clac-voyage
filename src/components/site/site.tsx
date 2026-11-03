/**
 * Site public d'un voyage : composant pur (sans état ni accès serveur), rendu
 * côté serveur pour le site en ligne et en HTML statique pour l'export .zip.
 * L'interactivité (visionneuse) est ajoutée par le script de src/lib/site/visionneuse.ts.
 */
import type { CSSProperties, ReactNode } from "react";
import { chapitres, ratioDe, type Bloc as BlocCarnet, type Chapitre } from "@/lib/site/carnet";
import { couleursEffectives, PRESENTATIONS } from "@/lib/site/config";
import type { DonneesSite, MediaSite } from "@/lib/site/types";
import { Carte } from "./carte";

const fmtMaj = (fuseau: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: fuseau });

function paragraphes(texte: string) {
  return texte
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
}

function ratio(m: MediaSite) {
  return m.largeur && m.hauteur ? m.largeur / m.hauteur : 1.5;
}

/** Image d'un média, cliquable pour ouvrir la visionneuse. */
function Vignette({
  m,
  tailles,
  className = "",
  cadre,
  prioritaire = false,
  taille = "m",
}: {
  m: MediaSite;
  tailles: string;
  className?: string;
  /** Forcer un format (sinon celui de la photo). */
  cadre?: string;
  prioritaire?: boolean;
  taille?: "s" | "m" | "l";
}) {
  const src = m.urls[taille] ?? m.urls.m ?? m.urls.affiche ?? m.urls.s;
  const srcSet = [m.urls.s && `${m.urls.s} 400w`, m.urls.m && `${m.urls.m} 1200w`, m.urls.l && `${m.urls.l} 2400w`]
    .filter(Boolean)
    .join(", ");
  const alt = m.legende ?? (m.type === "video" ? "Vidéo" : "Photo");
  return (
    <a
      href={m.urls.l ?? m.urls.video ?? src}
      data-media={m.id}
      className={`group relative block overflow-hidden bg-s-fond2 ${className}`}
      style={{ aspectRatio: cadre ?? String(ratio(m)) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- images servies par le stockage, déjà optimisées
        <img
          src={src}
          srcSet={m.type === "photo" && srcSet ? srcSet : undefined}
          sizes={tailles}
          alt={alt}
          width={m.largeur ?? undefined}
          height={m.hauteur ?? undefined}
          loading={prioritaire ? "eager" : "lazy"}
          fetchPriority={prioritaire ? "high" : undefined}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : null}
      {m.type === "video" ? (
        <span
          aria-hidden
          className="absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-sm text-white"
        >
          ▶
        </span>
      ) : null}
    </a>
  );
}

function Legende({ m }: { m: MediaSite }) {
  if (!m.legende) return null;
  return <figcaption className="mt-2 text-sm leading-relaxed text-s-douce">{m.legende}</figcaption>;
}

/* ------------------------- Présentations d'épisode ------------------------- */

function Mosaique({ medias }: { medias: MediaSite[] }) {
  const [vedettes, autres] = [medias.filter((m) => m.vedette), medias.filter((m) => !m.vedette)];
  return (
    <div className="space-y-2">
      {vedettes.map((m) => (
        <Vignette key={m.id} m={m} tailles="(min-width: 1024px) 1024px, 100vw" taille="l" />
      ))}
      <div className="columns-2 gap-2 sm:columns-3 [&>*]:mb-2 [&>*]:break-inside-avoid">
        {autres.map((m) => (
          <Vignette key={m.id} m={m} tailles="(min-width: 1024px) 340px, (min-width: 640px) 33vw, 50vw" />
        ))}
      </div>
    </div>
  );
}

function PleinEcran({ medias }: { medias: MediaSite[] }) {
  return (
    <div className="space-y-10">
      {medias.map((m) => (
        <figure key={m.id} className="-mx-4 sm:mx-0">
          <Vignette m={m} tailles="(min-width: 1024px) 1024px, 100vw" taille="l" className="max-h-[92svh]" />
          <div className="px-4 sm:px-0">
            <Legende m={m} />
          </div>
        </figure>
      ))}
    </div>
  );
}

function Defilement({ medias }: { medias: MediaSite[] }) {
  return (
    <div className="s-defilement -mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      {medias.map((m) => (
        <figure key={m.id} className="shrink-0" style={{ width: `min(85vw, ${Math.round(ratio(m) * 420)}px)` }}>
          <Vignette m={m} tailles="85vw" />
          <Legende m={m} />
        </figure>
      ))}
    </div>
  );
}

function Alterne({ medias }: { medias: MediaSite[] }) {
  return (
    <div className="space-y-10 sm:space-y-14">
      {medias.map((m, i) => (
        <figure key={m.id} className="grid items-center gap-4 sm:grid-cols-[3fr_2fr] sm:gap-8">
          <div className={i % 2 ? "sm:order-2" : ""}>
            <Vignette m={m} tailles="(min-width: 640px) 60vw, 100vw" />
          </div>
          <figcaption className={`text-lg leading-relaxed ${i % 2 ? "sm:order-1 sm:text-right" : ""}`}>
            {m.legende ?? null}
            {m.auteur ? <span className="mt-1 block text-sm text-s-douce">{m.auteur}</span> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Vedette({ medias }: { medias: MediaSite[] }) {
  const principale = medias.find((m) => m.vedette) ?? medias.find((m) => m.type === "photo") ?? medias[0];
  const autres = medias.filter((m) => m !== principale);
  return (
    <div className="space-y-2">
      <figure>
        <Vignette m={principale} tailles="(min-width: 1024px) 1024px, 100vw" taille="l" />
        <Legende m={principale} />
      </figure>
      {autres.length ? (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {autres.map((m) => (
            <Vignette key={m.id} m={m} cadre="1" taille="s" tailles="(min-width: 640px) 16vw, 25vw" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const PRESENTE: Record<Exclude<keyof typeof PRESENTATIONS, "carnet">, (p: { medias: MediaSite[] }) => ReactNode> = {
  mosaique: Mosaique,
  "plein-ecran": PleinEcran,
  defilement: Defilement,
  alterne: Alterne,
  vedette: Vedette,
};

/* ---------------------------------- Carnet ---------------------------------- */

/** Mots du groupe sous une photo : auteur, légende courte, réactions, commentaires. */
function Mots({ m, max = 2 }: { m: MediaSite; max?: number }) {
  const reste = m.commentaires.length - max;
  if (!m.legende && !m.commentaires.length && !m.reactions.length) return null;
  return (
    <div className="mt-2 space-y-1 text-sm leading-relaxed">
      {m.legende ? (
        <p>
          {m.legende}
          {m.auteur ? <span className="text-s-douce"> — {m.auteur}</span> : null}
        </p>
      ) : null}
      {m.commentaires.slice(0, max).map((c, i) => (
        <p key={i} className="text-s-douce">
          <span className="font-medium text-s-encre">{c.auteur}</span> {c.texte}
        </p>
      ))}
      {reste > 0 ? <p className="text-s-douce">et {reste} autre{reste > 1 ? "s" : ""} commentaire{reste > 1 ? "s" : ""}</p> : null}
      {m.reactions.length ? (
        <p aria-label="Réactions" className="text-s-douce">
          {m.reactions.map((r) => `${r.emoji}${r.nb > 1 ? ` ${r.nb}` : ""}`).join("  ")}
        </p>
      ) : null}
    </div>
  );
}

function BlocCarnetVue({ b }: { b: BlocCarnet }) {
  if (b.type === "grande") {
    return (
      <figure className="s-pleine -mx-4 sm:mx-0">
        <Vignette m={b.m} tailles="(min-width: 1100px) 1100px, 100vw" taille="l" className="max-h-[88svh] sm:rounded-sm" />
        <figcaption className="px-4 sm:px-0">
          <Mots m={b.m} />
        </figcaption>
      </figure>
    );
  }
  if (b.type === "rangee") {
    const total = b.medias.reduce((s, m) => s + ratioDe(m), 0);
    return (
      <div>
        {/* Rangée justifiée : chaque photo prend une largeur proportionnelle à son format, toutes à la même hauteur. */}
        <div className="flex gap-1.5 sm:gap-2">
          {b.medias.map((m) => (
            <figure key={m.id} className="min-w-0" style={{ flex: `${ratioDe(m)} 1 0%` }}>
              <Vignette m={m} tailles={`(min-width: 1100px) ${Math.round((1100 * ratioDe(m)) / total)}px, ${Math.round((100 * ratioDe(m)) / total)}vw`} className="sm:rounded-sm" />
            </figure>
          ))}
        </div>
        {b.medias.some((m) => m.legende || m.commentaires.length || m.reactions.length) ? (
          <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {b.medias.map((m) => (
              <Mots key={m.id} m={m} max={1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  const droite = b.cote === "droite";
  return (
    <figure className="grid items-center gap-5 sm:grid-cols-[3fr_2fr] sm:gap-10">
      <div className={droite ? "sm:order-2" : ""}>
        <Vignette m={b.m} tailles="(min-width: 1100px) 660px, (min-width: 640px) 60vw, 100vw" className="sm:rounded-sm" />
      </div>
      <figcaption className={`space-y-4 ${droite ? "sm:order-1" : ""}`}>
        {b.m.legende ? (
          <blockquote className="s-citation text-2xl leading-snug" style={{ fontFamily: "var(--s-police-titre)" }}>
            « {b.m.legende} »
            {b.m.auteur ? <footer className="mt-2 text-sm text-s-douce" style={{ fontFamily: "inherit" }}>— {b.m.auteur}</footer> : null}
          </blockquote>
        ) : null}
        {b.m.commentaires.length ? (
          <ul className="space-y-2 border-l-2 border-s-accent pl-4 text-sm leading-relaxed">
            {b.m.commentaires.slice(0, 6).map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.auteur}</span> <span className="text-s-douce">{c.texte}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {b.m.reactions.length ? <p className="text-s-douce">{b.m.reactions.map((r) => `${r.emoji}${r.nb > 1 ? ` ${r.nb}` : ""}`).join("  ")}</p> : null}
      </figcaption>
    </figure>
  );
}

function EnTeteChapitre({ c }: { c: Chapitre }) {
  const m = c.ouverture;
  const src = m?.urls.l ?? m?.urls.m;
  const textes = (
    <div className="mx-auto max-w-5xl space-y-2">
      <p className="text-sm font-medium uppercase tracking-[0.16em] opacity-90">
        {c.surtitre}
        {c.dates ? <span className="normal-case tracking-normal"> · {c.dates}</span> : null}
      </p>
      <h3 className="text-4xl leading-tight sm:text-6xl">{c.titre}</h3>
      {c.lieu ? <p className="text-lg opacity-90">{c.lieu}</p> : null}
    </div>
  );
  if (!m || !src) return <header className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 [&_p]:text-s-douce [&_p:first-child]:text-s-accent">{textes}</header>;
  return (
    <header className="relative isolate flex min-h-[72svh] items-end overflow-hidden bg-s-fond2">
      <a href={m.urls.l ?? src} data-media={m.id} className="absolute inset-0 -z-10" aria-label={m.legende ?? `Photo d’ouverture : ${c.titre}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- image du stockage, déjà optimisée */}
        <img
          src={src}
          srcSet={[m.urls.m && `${m.urls.m} 1200w`, m.urls.l && `${m.urls.l} 2400w`].filter(Boolean).join(", ") || undefined}
          sizes="100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </a>
      <div className="pointer-events-none w-full bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-10 pt-40 text-white sm:px-10 sm:pb-14">{textes}</div>
    </header>
  );
}

function ChapitreVue({ c, suivant }: { c: Chapitre; suivant: Chapitre | null }) {
  const Ancienne = c.presentation && c.presentation !== "carnet" ? PRESENTE[c.presentation] : null;
  return (
    <article id={c.id} data-groupe className="scroll-mt-4">
      <EnTeteChapitre c={c} />
      <div className="mx-auto max-w-[1100px] space-y-10 px-4 py-12 sm:space-y-14 sm:px-6 sm:py-16">
        {c.recit ? <div className="s-texte s-lettrine mx-auto max-w-prose text-lg leading-relaxed sm:text-xl">{paragraphes(c.recit)}</div> : null}
        {Ancienne ? (
          <Ancienne medias={c.medias} />
        ) : (
          c.parties.map((p, i) => (
            <section key={i} className="space-y-6 sm:space-y-10">
              {p.jour ? (
                <h4 className="flex items-center gap-4 text-sm font-medium uppercase tracking-[0.14em] text-s-douce">
                  <span className="h-px flex-1 bg-s-filet" />
                  {p.jour}
                  <span className="h-px flex-1 bg-s-filet" />
                </h4>
              ) : null}
              {p.blocs.map((b, j) => (
                <BlocCarnetVue key={j} b={b} />
              ))}
            </section>
          ))
        )}
        {suivant ? (
          <a href={`#${suivant.id}`} className="group mt-6 flex items-center justify-between gap-4 border-t border-s-filet pt-6">
            <span>
              <span className="block text-sm uppercase tracking-[0.14em] text-s-douce">À suivre · {suivant.surtitre}</span>
              <span className="text-2xl group-hover:text-s-accent" style={{ fontFamily: "var(--s-police-titre)" }}>
                {suivant.titre} →
              </span>
            </span>
            {suivant.ouverture?.urls.s ? (
              // eslint-disable-next-line @next/next/no-img-element -- vignette du stockage
              <img src={suivant.ouverture.urls.s} alt="" loading="lazy" className="h-20 w-28 shrink-0 rounded-sm object-cover sm:h-24 sm:w-36" />
            ) : null}
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** Sommaire en vignettes : donne envie d'ouvrir chaque chapitre. */
function Sommaire({ liste }: { liste: Chapitre[] }) {
  return (
    <nav aria-label="Sommaire" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Titre id="sommaire">Au sommaire</Titre>
      <ol className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {liste.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className="group block">
              <span className="block aspect-[4/3] overflow-hidden rounded-sm bg-s-fond2">
                {c.ouverture?.urls.m ?? c.ouverture?.urls.s ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette du stockage
                  <img src={c.ouverture.urls.m ?? c.ouverture.urls.s} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : null}
              </span>
              <span className="mt-2 block text-xs font-medium uppercase tracking-[0.14em] text-s-accent">{c.surtitre}</span>
              <span className="block text-lg leading-snug group-hover:underline" style={{ fontFamily: "var(--s-police-titre)" }}>
                {c.titre}
              </span>
              <span className="text-sm text-s-douce">
                {c.nbMedias} photo{c.nbMedias > 1 ? "s" : ""}
                {c.lieu ? ` · ${c.lieu}` : ""}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* --------------------------------- Sections -------------------------------- */

function Couverture({ d }: { d: DonneesSite }) {
  const m = d.couverture;
  const src = m?.urls.l ?? m?.urls.m;
  return (
    <header className="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-s-fond2">
      {m && src ? (
        // eslint-disable-next-line @next/next/no-img-element -- image du stockage, déjà optimisée
        <img
          src={src}
          srcSet={[m.urls.m && `${m.urls.m} 1200w`, m.urls.l && `${m.urls.l} 2400w`].filter(Boolean).join(", ") || undefined}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
      ) : null}
      <div className={`w-full px-5 pb-12 pt-32 sm:px-10 sm:pb-16 ${m ? "bg-gradient-to-t from-black/70 via-black/25 to-transparent text-white" : ""}`}>
        <div className="mx-auto max-w-5xl space-y-3">
          {d.periode ? <p className="text-sm font-medium uppercase tracking-[0.16em] opacity-90">{d.periode}</p> : null}
          <h1 className="text-5xl leading-[1.05] sm:text-7xl">{d.nom}</h1>
          {d.config.sousTitre ? <p className="max-w-2xl text-lg opacity-90 sm:text-xl">{d.config.sousTitre}</p> : null}
        </div>
      </div>
    </header>
  );
}

function Titre({ children, id }: { children: ReactNode; id: string }) {
  return (
    <h2 id={id} className="scroll-mt-6 text-sm font-medium uppercase tracking-[0.16em] text-s-douce" style={{ fontFamily: "inherit" }}>
      {children}
    </h2>
  );
}

function Bloc({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return <section className={`mx-auto w-full px-4 py-12 sm:px-6 sm:py-16 ${large ? "max-w-5xl" : "max-w-3xl"}`}>{children}</section>;
}

function Chiffres({ d }: { d: DonneesSite }) {
  const c = d.chiffres;
  const lignes: [number, string, string][] = [
    [c.jours, "jour", "jours"],
    [c.photos, "photo", "photos"],
    [c.videos, "vidéo", "vidéos"],
    [c.episodes, "épisode", "épisodes"],
    [c.km, "kilomètre parcouru", "kilomètres parcourus"],
    [c.participants, "voyageur", "voyageurs"],
    [c.commentaires, "commentaire", "commentaires"],
    [c.reactions, "réaction", "réactions"],
  ];
  const nf = new Intl.NumberFormat("fr-FR");
  return (
    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      {lignes
        .filter(([n]) => n > 0)
        .map(([n, un, plusieurs]) => (
          <div key={plusieurs} className="border-t border-s-filet pt-3">
            <dt className="sr-only">{plusieurs}</dt>
            <dd>
              <span className="s-numero block text-4xl text-s-accent" style={{ fontFamily: "var(--s-police-titre)" }}>
                {nf.format(n)}
              </span>
              <span className="text-sm text-s-douce">{n > 1 ? plusieurs : un}</span>
            </dd>
          </div>
        ))}
    </dl>
  );
}

function Galerie({ d }: { d: DonneesSite }) {
  const tous = [...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes];
  // Colonnes « maçonnerie » : chaque photo garde son format.
  return (
    <div data-groupe className="mt-6 columns-2 gap-1.5 sm:columns-3 lg:columns-4 [&>*]:mb-1.5 [&>*]:break-inside-avoid">
      {tous.map((m) => (
        <Vignette key={m.id} m={m} taille="s" tailles="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw" />
      ))}
    </div>
  );
}

export function Site({ d, enLigne = true, pied }: { d: DonneesSite; enLigne?: boolean; pied?: ReactNode }) {
  const c = couleursEffectives(d.config);
  const style = {
    "--s-fond": c.fond,
    "--s-fond2": c.fond2,
    "--s-encre": c.encre,
    "--s-encre-douce": c.encreDouce,
    "--s-filet": c.filet,
    "--s-accent": c.accent,
  } as CSSProperties;
  const ordre = chapitres(d, d.config.organisation);
  const liste = d.journal ? [...ordre].reverse() : ordre;
  const actives = d.config.sections.filter((s) => s.actif);
  const aCouverture = actives[0]?.id === "couverture";

  const contenu: Record<string, ReactNode> = {
    couverture: <Couverture key="couverture" d={d} />,
    presentation: d.config.presentation ? (
      <Bloc key="presentation">
        <div className="s-texte text-xl leading-relaxed sm:text-2xl" style={{ fontFamily: "var(--s-police-titre)" }}>
          {paragraphes(d.config.presentation)}
        </div>
      </Bloc>
    ) : null,
    carte:
      d.carte.length > 1 ? (
        <Bloc key="carte" large>
          <Titre id="carte">L’itinéraire</Titre>
          <Carte points={d.carte} />
        </Bloc>
      ) : null,
    episodes: liste.length ? (
      <section key="episodes" aria-label={d.journal ? "Le journal" : "Le carnet"}>
        {liste.length > 2 ? <Sommaire liste={liste} /> : null}
        {d.journal ? (
          <p className="mx-auto max-w-5xl px-4 text-sm text-s-douce sm:px-6">Le journal, du plus récent au plus ancien.</p>
        ) : null}
        {liste.map((c, i) => (
          <ChapitreVue key={c.id} c={c} suivant={liste[i + 1] ?? null} />
        ))}
      </section>
    ) : null,
    galerie: (
      <Bloc key="galerie" large>
        <Titre id="galerie">Toutes les photos</Titre>
        <Galerie d={d} />
      </Bloc>
    ),
    chiffres: (
      <Bloc key="chiffres" large>
        <Titre id="chiffres">Le voyage en chiffres</Titre>
        <Chiffres d={d} />
      </Bloc>
    ),
    participants: d.participants.length ? (
      <Bloc key="participants">
        <Titre id="participants">Les voyageurs</Titre>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-2xl" style={{ fontFamily: "var(--s-police-titre)" }}>
          {d.participants.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </Bloc>
    ) : null,
    fin: d.config.motDeLaFin ? (
      <Bloc key="fin">
        <Titre id="fin">Le mot de la fin</Titre>
        <div className="s-texte mt-5 text-xl leading-relaxed" style={{ fontFamily: "var(--s-police-titre)" }}>
          {paragraphes(d.config.motDeLaFin)}
        </div>
      </Bloc>
    ) : null,
  };

  // Données de la visionneuse : uniquement ce qui est déjà affiché sur la page.
  const medias: Record<string, Omit<MediaSite, "id" | "largeur" | "hauteur" | "vedette">> = {};
  for (const m of [...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes]) {
    medias[m.id] = {
      type: m.type,
      urls: m.urls,
      legende: m.legende,
      auteur: m.auteur,
      instant: m.instant,
      reactions: m.reactions,
      commentaires: m.commentaires,
    };
  }
  const json = JSON.stringify({ fuseau: d.fuseau, medias }).replace(/</g, "\\u003c");

  return (
    <div className="site flex min-h-full flex-1 flex-col" data-theme={d.config.theme} data-polices={d.config.polices} style={style}>
      {!aCouverture ? (
        <header className="mx-auto w-full max-w-5xl px-4 pb-4 pt-12 sm:px-6">
          {d.periode ? <p className="text-sm uppercase tracking-[0.16em] text-s-douce">{d.periode}</p> : null}
          <h1 className="mt-2 text-5xl sm:text-6xl">{d.nom}</h1>
        </header>
      ) : null}
      {d.journal ? (
        <p className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-s-filet px-3 py-1 text-sm text-s-douce">
          <span aria-hidden className="h-2 w-2 rounded-full bg-s-accent" />
          Journal en direct · mis à jour le {fmtMaj(d.fuseau).format(new Date(d.majLe))}
        </p>
      ) : null}
      <main className="flex-1">{actives.map((s) => contenu[s.id])}</main>
      <footer className="border-t border-s-filet px-4 py-8 text-center text-sm text-s-douce">
        {pied}
        <p className="mt-2">
          {enLigne ? "Site privé, partagé par lien secret." : "Archive hors ligne."} Réalisé avec Clic-Clac Voyage.
        </p>
      </footer>
      <script type="application/json" id="donnees-visionneuse" dangerouslySetInnerHTML={{ __html: json }} />
    </div>
  );
}
