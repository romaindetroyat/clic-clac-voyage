import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lireExif } from "@/lib/import/analyse";
import { exifHeif } from "@/lib/import/heif";

const F = (n: string) => new Blob([readFileSync(path.join(__dirname, "../e2e/fixtures", n))]);

describe("EXIF des photos HEIC (iPhone)", () => {
  it("trouve l'en-tête TIFF dans l'élément Exif", async () => {
    const t = await exifHeif(F("IMG_0004.HEIC"));
    expect(t).not.toBeNull();
    expect(String.fromCharCode(t![0], t![1])).toMatch(/II|MM/);
  });

  it("lit date, décalage horaire et appareil d'une HEIC (même EXIF que IMG_0001.jpg)", async () => {
    const heic = await lireExif(F("IMG_0004.HEIC"));
    expect(heic).toMatchObject({
      priseLocale: "2026-08-03T14:00:00",
      decalageExifMinutes: 180,
      appareil: { libelle: "Apple iPhone 15" },
    });
  });

  it("un fichier qui n'est pas une HEIC ne plante pas", async () => {
    expect(await exifHeif(F("IMG_0001.jpg"))).toBeNull();
    expect(await exifHeif(new Blob([new Uint8Array(10)]))).toBeNull();
  });
});
