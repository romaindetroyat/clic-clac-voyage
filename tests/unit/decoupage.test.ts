import { describe, expect, it } from "vitest";
import { decouper, distanceKm, jourLocal, titreAuto, type PointMedia } from "@/server/domaine/decoupage";

const ATHENES = "Europe/Athens";
let n = 0;
/** Une rafale de `nb` photos à partir d'une heure UTC, espacées de 10 minutes. */
function serie(isoDebut: string, nb: number, lieu?: [number, number]): PointMedia[] {
  const t0 = new Date(isoDebut).getTime();
  return Array.from({ length: nb }, (_, i) => ({
    id: `m${n++}`,
    instant: new Date(t0 + i * 10 * 60_000),
    latitude: lieu?.[0] ?? null,
    longitude: lieu?.[1] ?? null,
  }));
}
const NAXOS: [number, number] = [37.105, 25.376];
const PAROS: [number, number] = [37.085, 25.15]; // ~20 km
const SANTORIN: [number, number] = [36.416, 25.432]; // ~77 km de Naxos

describe("découpage en épisodes", () => {
  it("coupe à chaque nuit", () => {
    const m = [...serie("2026-08-03T06:00:00Z", 10), ...serie("2026-08-04T06:00:00Z", 8), ...serie("2026-08-05T07:00:00Z", 12)];
    const { groupes } = decouper(m, ATHENES);
    expect(groupes.map((g) => g.ids.length)).toEqual([10, 8, 12]);
  });

  it("ne coupe pas une soirée qui déborde après minuit", () => {
    // 21 h → 2 h du matin heure d'Athènes : même soirée.
    const m = serie("2026-08-03T18:00:00Z", 30);
    expect(decouper(m, ATHENES).groupes).toHaveLength(1);
  });

  it("coupe une même journée en deux étapes éloignées", () => {
    const m = [...serie("2026-08-03T05:00:00Z", 6, NAXOS), ...serie("2026-08-03T09:00:00Z", 6, SANTORIN)];
    expect(decouper(m, ATHENES).groupes.map((g) => g.ids.length)).toEqual([6, 6]);
  });

  it("ne coupe pas pour un petit déplacement", () => {
    const m = [...serie("2026-08-03T05:00:00Z", 6, NAXOS), ...serie("2026-08-03T08:00:00Z", 6, PAROS)];
    expect(decouper(m, ATHENES).groupes).toHaveLength(1);
  });

  it("rattache un épisode trop maigre à son voisin, sauf s'il est isolé", () => {
    const m = [...serie("2026-08-03T06:00:00Z", 10), ...serie("2026-08-03T14:00:00Z", 2), ...serie("2026-08-10T06:00:00Z", 2)];
    const { groupes } = decouper(m, ATHENES);
    // Les 2 photos de l'après-midi rejoignent le matin ; les 2 photos du 10 août restent à part.
    expect(groupes.map((g) => g.ids.length)).toEqual([12, 2]);
  });

  it("met de côté les médias sans date", () => {
    const m = [...serie("2026-08-03T06:00:00Z", 5), { id: "x", instant: null, latitude: null, longitude: null }];
    const r = decouper(m, ATHENES);
    expect(r.sansDate).toEqual(["x"]);
    expect(r.groupes[0].ids).toHaveLength(5);
    expect(decouper([], ATHENES).groupes).toEqual([]);
  });

  it("calcule distances et jours locaux", () => {
    expect(Math.round(distanceKm({ latitude: NAXOS[0], longitude: NAXOS[1] }, { latitude: SANTORIN[0], longitude: SANTORIN[1] }))).toBe(77);
    expect(jourLocal(new Date("2026-08-03T22:30:00Z"), ATHENES)).toBe("2026-08-03"); // 1 h 30 du matin : encore la veille
    expect(jourLocal(new Date("2026-08-04T02:00:00Z"), ATHENES)).toBe("2026-08-04");
  });

  it("propose des titres lisibles", () => {
    expect(titreAuto(new Date("2026-08-03T06:00:00Z"), new Date("2026-08-03T18:00:00Z"), ATHENES)).toBe("Lundi 3 août");
    expect(titreAuto(new Date("2026-08-03T06:00:00Z"), new Date("2026-08-05T18:00:00Z"), ATHENES)).toBe("Du 3 au 5 août");
    expect(titreAuto(new Date("2026-07-30T06:00:00Z"), new Date("2026-08-02T18:00:00Z"), ATHENES)).toBe("Du 30 juillet au 2 août");
  });
});
