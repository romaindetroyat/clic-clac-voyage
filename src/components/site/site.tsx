/**
 * Site public d'un voyage : composant pur (sans état ni accès serveur), rendu
 * côté serveur pour le site en ligne et en HTML statique pour l'export .zip.
 * L'interactivité (visionneuse) est ajoutée par le script de src/lib/site/visionneuse.ts.
 */
import type { CSSProperties, ReactNode } from "react";
import { couleursEffectives, PRESENTATIONS } from "@/lib/site/config";
import type { DonneesSite, EpisodeSite, MediaSite } from "@/lib/site/types";
import { Carte } from "./carte";

const fmtJour = (fuseau: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: fuseau });
const fmtMaj = (fuseau: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: fuseau });

function paragraphes(texte: string) {
  return texte
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
}

function datesEpisode(e: EpisodeSite, fuseau: string) {
  if (!e.debut) return null;
  const f = fmtJour(fuseau);
  const a = f.format(new Date(e.debut));
  const b = e.fin ? f.format(new Date(e.fin)) : a;
  return a === b ? a : `${a} – ${b}`;
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

const PRESENTE: Record<keyof typeof PRESENTATIONS, (p: { medias: MediaSite[] }) => ReactNode> = {
  mosaique: Mosaique,
  "plein-ecran": PleinEcran,
  defilement: Defilement,
  alterne: Alterne,
  vedette: Vedette,
};

function Episode({ e, n, fuseau }: { e: EpisodeSite; n: number; fuseau: string }) {
  const Corps = PRESENTE[e.presentation];
  const dates = datesEpisode(e, fuseau);
  return (
    <article id={`episode-${n}`} data-groupe className="scroll-mt-6 space-y-6">
      <header className="space-y-2">
        <p className="s-numero text-sm font-medium uppercase tracking-[0.14em] text-s-accent">
          Épisode {n}
          {dates ? <span className="text-s-douce"> · {dates}</span> : null}
        </p>
        <h3 className="text-3xl leading-tight sm:text-4xl">{e.titre}</h3>
        {e.lieu ? <p className="text-s-douce">{e.lieu}</p> : null}
      </header>
      {e.recit ? <div className="s-texte max-w-prose text-lg leading-relaxed">{paragraphes(e.recit)}</div> : null}
      {e.medias.length ? <Corps medias={e.medias} /> : null}
    </article>
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
  return (
    <div data-groupe className="mt-6 grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-6">
      {tous.map((m) => (
        <Vignette key={m.id} m={m} cadre="1" taille="s" tailles="(min-width: 1024px) 170px, (min-width: 640px) 20vw, 33vw" />
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
  const episodes = d.journal ? [...d.episodes].reverse() : d.episodes;
  const numero = new Map(d.episodes.map((e, i) => [e.id, i + 1]));
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
    episodes: episodes.length ? (
      <Bloc key="episodes" large>
        <Titre id="episodes">{d.journal ? "Le journal, du plus récent au plus ancien" : "Le voyage, épisode par épisode"}</Titre>
        {episodes.length > 2 ? (
          <nav aria-label="Épisodes" className="mt-4">
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {episodes.map((e) => (
                <li key={e.id}>
                  <a href={`#episode-${numero.get(e.id)}`} className="text-s-douce underline decoration-s-filet underline-offset-4 hover:text-s-encre">
                    {e.titre}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="mt-12 space-y-20 sm:space-y-28">
          {episodes.map((e) => (
            <Episode key={e.id} e={e} n={numero.get(e.id)!} fuseau={d.fuseau} />
          ))}
        </div>
      </Bloc>
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
