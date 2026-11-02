import { describe, expect, it } from "vitest";
import {
  decalageFuseauMinutes,
  formaterDecalage,
  instantCorrige,
  lireDecalage,
  priseVersUtc,
  trierChronologiquement,
} from "@/server/domaine/temps";

describe("heure de prise de vue", () => {
  it("utilise le décalage EXIF quand il existe", () => {
    expect(priseVersUtc("2026-08-03T14:00:00", 180, "Europe/Paris")!.toISOString()).toBe("2026-08-03T11:00:00.000Z");
    expect(priseVersUtc("2026-08-03T14:00:00", -300, "Europe/Paris")!.toISOString()).toBe("2026-08-03T19:00:00.000Z");
  });

  it("sinon, applique le fuseau du voyage avec l'heure d'été", () => {
    expect(priseVersUtc("2026-08-03T14:00:00", null, "Europe/Athens")!.toISOString()).toBe("2026-08-03T11:00:00.000Z");
    expect(priseVersUtc("2026-01-15T14:00:00", null, "Europe/Paris")!.toISOString()).toBe("2026-01-15T13:00:00.000Z");
    // Juste après le passage à l'heure d'été (29 mars 2026, 3 h à Paris).
    expect(priseVersUtc("2026-03-29T03:30:00", null, "Europe/Paris")!.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("rejette les dates absentes ou absurdes", () => {
    expect(priseVersUtc(null, null, "Europe/Paris")).toBeNull();
    expect(priseVersUtc("0000-00-00T00:00:00", null, "Europe/Paris")).toBeNull();
    expect(priseVersUtc("n'importe quoi", null, "Europe/Paris")).toBeNull();
  });

  it("connaît les décalages des fuseaux", () => {
    expect(decalageFuseauMinutes("Asia/Kolkata", new Date("2026-06-01T00:00:00Z"))).toBe(330);
    expect(decalageFuseauMinutes("America/New_York", new Date("2026-01-01T00:00:00Z"))).toBe(-300);
  });
});

describe("recalage d'horloge par appareil", () => {
  it("décale l'instant de l'appareil", () => {
    const t = new Date("2026-08-03T10:00:00Z");
    expect(instantCorrige(t, 72 * 60)!.toISOString()).toBe("2026-08-03T11:12:00.000Z");
    expect(instantCorrige(t, -30)!.toISOString()).toBe("2026-08-03T09:59:30.000Z");
    expect(instantCorrige(null, 100)).toBeNull();
  });

  it("remet dans l'ordre les photos de deux appareils décalés", () => {
    // Paul avait 1 h 12 de retard : sa photo « 10:00 » a été prise à 11:12 réelles.
    const paul = 72 * 60;
    const medias = [
      { id: "p1", nomFichier: "P1.jpg", instant: instantCorrige(new Date("2026-08-03T10:00:00Z"), paul) },
      { id: "r1", nomFichier: "IMG_1.HEIC", instant: instantCorrige(new Date("2026-08-03T11:00:00Z"), 0) },
      { id: "r2", nomFichier: "IMG_2.HEIC", instant: instantCorrige(new Date("2026-08-03T11:30:00Z"), 0) },
      { id: "x", nomFichier: "sans-date.png", instant: null },
    ];
    expect(trierChronologiquement(medias).map((m) => m.id)).toEqual(["r1", "p1", "r2", "x"]);
  });

  it("départage les égalités par nom de fichier, numériquement", () => {
    const t = new Date("2026-08-03T11:00:00Z");
    const medias = [
      { id: "b", nomFichier: "IMG_10.jpg", instant: t },
      { id: "a", nomFichier: "IMG_9.jpg", instant: t },
    ];
    expect(trierChronologiquement(medias).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("lit les décalages saisis en français", () => {
    expect(lireDecalage("+1 h 12")).toBe(4320);
    expect(lireDecalage("1h12min")).toBe(4320);
    expect(lireDecalage("-3 min")).toBe(-180);
    expect(lireDecalage("−1 j 2 h")).toBe(-93600);
    expect(lireDecalage("+01:12")).toBe(4320);
    expect(lireDecalage("-00:00:45")).toBe(-45);
    expect(lireDecalage("")).toBe(0);
    expect(lireDecalage("demain")).toBeNull();
    expect(lireDecalage("1 h et des poussières")).toBeNull();
  });

  it("affiche les décalages lisiblement", () => {
    expect(formaterDecalage(4320)).toBe("+1 h 12 min");
    expect(formaterDecalage(-45)).toBe("−45 s");
    expect(formaterDecalage(0)).toBe("aucun");
  });
});
