import { describe, expect, it } from "vitest";
import { chapitres, choisirOuverture, mettreEnPage, mediasDuBloc } from "@/lib/site/carnet";
import { configParDefaut } from "@/lib/site/config";
import type { DonneesSite, EpisodeSite, MediaSite } from "@/lib/site/types";

let n = 0;
const m = (o: Partial<MediaSite> & { l?: number; h?: number } = {}): MediaSite => ({
  id: `m${++n}`,
  type: "photo",
  largeur: o.l ?? 1600,
  hauteur: o.h ?? 1067,
  urls: { s: "s", m: "m", l: "l" },
  legende: null,
  auteur: null,
  instant: "2026-08-03T10:00:00.000Z",
  vedette: false,
  reactions: [],
  commentaires: [],
  ...o,
});
const paysage = (o: Partial<MediaSite> = {}) => m({ l: 1600, h: 1067, ...o });
const portrait = (o: Partial<MediaSite> = {}) => m({ l: 1067, h: 1600, ...o });
const types = (b: ReturnType<typeof mettreEnPage>) => b.map((x) => (x.type === "rangee" ? `rangee${x.medias.length}` : x.type));

describe("mise en page du carnet", () => {
  it("rangées de deux paysages ou de trois portraits", () => {
    expect(types(mettreEnPage([paysage(), paysage(), portrait(), portrait(), portrait()]))).toEqual(["rangee2", "rangee3"]);
  });

  it("vedettes et vidéos en grand, photos commentées à côté de leurs mots", () => {
    const bavarde = paysage({ commentaires: [{ auteur: "Léa", texte: "Quelle lumière !" }, { auteur: "Paul", texte: "Superbe" }] });
    const blocs = mettreEnPage([paysage(), paysage({ vedette: true }), paysage(), bavarde, paysage(), m({ type: "video" })]);
    expect(types(blocs)).toEqual(["grande", "grande", "grande", "note", "grande", "grande"]);
  });

  it("une grande photo de paysage toutes les trois rangées, pour respirer", () => {
    const l = Array.from({ length: 9 }, () => paysage());
    expect(types(mettreEnPage(l))).toEqual(["rangee2", "rangee2", "rangee2", "grande", "rangee2"]);
  });

  it("chaque média est placé une fois et une seule, dans l'ordre", () => {
    const l = [portrait(), paysage(), portrait(), paysage({ vedette: true }), portrait(), paysage(), paysage(), portrait()];
    const places = mettreEnPage(l).flatMap(mediasDuBloc);
    expect(places.map((x) => x.id)).toEqual(l.map((x) => x.id));
  });

  it("ouverture : la vedette, sinon un paysage, jamais une vidéo", () => {
    const v = paysage({ vedette: true });
    expect(choisirOuverture([portrait(), paysage(), v])).toBe(v);
    const p = paysage();
    expect(choisirOuverture([m({ type: "video" }), portrait(), p])).toBe(p);
    expect(choisirOuverture([m({ type: "video" })])).toBeNull();
  });
});

describe("chapitres", () => {
  const jour = (j: number, h = 10) => `2026-08-0${j}T${String(h).padStart(2, "0")}:00:00.000Z`;
  const donnees = (episodes: EpisodeSite[], horsEpisodes: MediaSite[]): DonneesSite => ({
    slug: "naxos",
    nom: "Naxos",
    periode: null,
    fuseau: "Europe/Athens",
    config: configParDefaut(),
    couverture: null,
    episodes,
    horsEpisodes,
    carte: [],
    chiffres: { jours: 0, photos: 0, videos: 0, episodes: 0, participants: 0, km: 0, commentaires: 0, reactions: 0 },
    participants: [],
    journal: false,
    majLe: "",
  });

  it("par jour : Jour 1, Jour 3… (numérotés depuis le premier jour), puis les médias sans date", () => {
    const d = donnees([], [paysage({ instant: jour(5) }), paysage({ instant: jour(3) }), paysage({ instant: null }), paysage({ instant: jour(3, 15) })]);
    const c = chapitres(d, "auto");
    expect(c.map((x) => [x.surtitre, x.titre, x.nbMedias])).toEqual([
      ["Jour 1", "Lundi 3 août", 2],
      ["Jour 3", "Mercredi 5 août", 1],
      ["En vrac", "Encore quelques images", 1],
    ]);
  });

  it("par épisode : titre, lieu et récit de l'épisode, une sous-partie par jour", () => {
    const e: EpisodeSite = {
      id: "e1",
      ordre: 0,
      titre: "Naxos, la grande île",
      lieu: "Naxos",
      recit: "Arrivée au port.",
      debut: jour(3),
      fin: jour(4),
      presentation: "carnet",
      medias: [paysage({ instant: jour(3) }), paysage({ instant: jour(3, 12) }), paysage({ instant: jour(4) }), paysage({ instant: jour(4, 12) })],
    };
    const [c] = chapitres(donnees([e], []), "auto");
    expect([c.id, c.surtitre, c.titre, c.lieu, c.recit, c.dates]).toEqual([
      "episode-1",
      "Jours 1 à 2",
      "Naxos, la grande île",
      "Naxos",
      "Arrivée au port.",
      "lundi 3 août – mardi 4 août",
    ]);
    expect(c.parties.map((p) => p.jour)).toEqual(["Jour 1 · lundi 3 août", "Jour 2 · mardi 4 août"]);
    // La photo d'ouverture n'est pas répétée dans le fil.
    expect(c.parties.flatMap((p) => p.blocs).flatMap(mediasDuBloc)).not.toContain(c.ouverture);

    // Même voyage, chapitres par jour : le récit de l'épisode s'affiche à son premier jour.
    const parJour = chapitres(donnees([e], []), "jours");
    expect(parJour.map((x) => [x.titre, x.recit, x.lieu])).toEqual([
      ["Naxos, la grande île", "Arrivée au port.", "Naxos"],
      ["Mardi 4 août", null, "Naxos"],
    ]);
  });
});
