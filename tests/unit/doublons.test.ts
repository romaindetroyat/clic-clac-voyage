import { describe, expect, it } from "vitest";
import { deciderDoublon, distanceHamming, memePhoto, type Empreinte } from "@/server/domaine/doublons";

const original: Empreinte = {
  id: "orig",
  dhash: "f0e1d2c3b4a59687",
  largeur: 4032,
  hauteur: 3024,
  taille: 3_500_000,
  instant: new Date("2026-08-03T11:00:00Z"),
};
// La même photo passée par WhatsApp : 1600 px, quelques bits d'écart, pas de date EXIF.
const copieWhatsapp: Empreinte = {
  id: "wa",
  dhash: "f0e1d2c3b4a59685",
  largeur: 1600,
  hauteur: 1200,
  taille: 180_000,
  instant: null,
  copieCompressee: true,
};

describe("empreintes perceptuelles", () => {
  it("calcule la distance de Hamming", () => {
    expect(distanceHamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(distanceHamming("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(distanceHamming("f0e1d2c3b4a59687", "f0e1d2c3b4a59685")).toBe(1);
    expect(distanceHamming("abc", "def")).toBe(64);
  });

  it("reconnaît la même photo recompressée, même tournée", () => {
    expect(memePhoto(original, copieWhatsapp)).toBe(true);
    expect(memePhoto(original, { ...copieWhatsapp, largeur: 1200, hauteur: 1600 })).toBe(true);
  });

  it("ne confond pas les photos d'une rafale (deux originaux à quelques secondes d'écart)", () => {
    const suivante = { ...original, id: "rafale-2", instant: new Date("2026-08-03T11:00:02Z") };
    expect(memePhoto(original, suivante)).toBe(false);
    // Deux images d'une rafale dans la même seconde : même format, même personne, même taille.
    const a = { ...original, mime: "image/heic", auteurId: "romain" };
    expect(memePhoto(a, { ...a, id: "rafale-bis" })).toBe(false);
    // Le même instant venant d'ailleurs (HEIC et son export JPEG envoyé par Paul) : même photo.
    expect(memePhoto(a, { ...a, id: "jpeg", mime: "image/jpeg", auteurId: "paul", largeur: 2016, hauteur: 1512 })).toBe(true);
    // Une copie WhatsApp datée par l'heure du message reste reconnue.
    expect(memePhoto(original, { ...copieWhatsapp, instant: new Date("2026-08-03T12:01:00Z") })).toBe(true);
  });

  it("une date tirée du nom du fichier (approchée) n'empêche pas de reconnaître la même photo", () => {
    const copieDatee = { ...copieWhatsapp, copieCompressee: false, dateApprochee: true, instant: new Date("2026-08-03T09:00:00Z") };
    expect(memePhoto(original, copieDatee)).toBe(true);
    expect(memePhoto(original, { ...copieDatee, dateApprochee: false })).toBe(false);
  });

  it("distingue deux photos différentes", () => {
    expect(memePhoto(original, { ...copieWhatsapp, dhash: "0f1e2d3c4b5a6978" })).toBe(false);
    expect(memePhoto(original, { ...copieWhatsapp, largeur: 1600, hauteur: 900 })).toBe(false); // 16/9 ≠ 4/3
    expect(memePhoto(original, { ...copieWhatsapp, instant: new Date("2026-08-10T11:00:00Z") })).toBe(false);
    expect(memePhoto(original, { ...original, id: "x", instant: new Date("2026-08-03T11:00:05Z"), copieCompressee: false })).toBe(false);
    expect(memePhoto(original, { ...copieWhatsapp, dhash: null })).toBe(false);
  });
});

describe("décision de dédoublonnage", () => {
  it("la copie WhatsApp arrivée après l'original est masquée", () => {
    expect(deciderDoublon(copieWhatsapp, [original])).toEqual({ action: "masquer-nouveau", garde: "orig" });
  });

  it("l'original arrivé après la copie WhatsApp la remplace", () => {
    expect(deciderDoublon(original, [copieWhatsapp])).toEqual({ action: "remplacer", masque: "wa" });
  });

  it("entre deux versions non compressées, garde la plus grande", () => {
    const petite = { ...original, id: "petite", largeur: 2016, hauteur: 1512, taille: 900_000 };
    expect(deciderDoublon(petite, [original])).toEqual({ action: "masquer-nouveau", garde: "orig" });
    expect(deciderDoublon(original, [petite])).toEqual({ action: "remplacer", masque: "petite" });
  });

  it("ne touche à rien sans photo proche", () => {
    expect(deciderDoublon({ ...original, id: "autre", dhash: "0123456789abcdef" }, [original])).toEqual({ action: "aucune" });
  });
});
