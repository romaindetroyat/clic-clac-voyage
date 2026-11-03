import { describe, expect, it } from "vitest";
import { dateDepuisNom } from "@/lib/import/date-nom";

const maintenant = new Date("2026-11-03T12:00:00Z");
const d = (nom: string) => dateDepuisNom(nom, maintenant);

describe("date dans le nom du fichier", () => {
  it.each([
    ["WhatsApp Image 2026-08-03 at 14.32.10.jpeg", "2026-08-03T14:32:10"],
    ["WhatsApp Video 2026-08-03 at 14.32.10 (1).mp4", "2026-08-03T14:32:10"],
    ["IMG_20260803_143210.jpg", "2026-08-03T14:32:10"],
    ["VID_20260803_143210.mp4", "2026-08-03T14:32:10"],
    ["PXL_20260803_143210123.jpg", "2026-08-03T14:32:10"],
    ["PXL_20260803_143210123.MP.jpg", "2026-08-03T14:32:10"],
    ["20260803_143210.jpg", "2026-08-03T14:32:10"],
    ["Screenshot_20260803-143210.png", "2026-08-03T14:32:10"],
    ["Screenshot_20260803-143210_Instagram.jpg", "2026-08-03T14:32:10"],
    ["Capture d’écran 2026-08-03 à 14.32.10.png", "2026-08-03T14:32:10"],
    ["Screenshot 2026-08-03 at 14.32.10.png", "2026-08-03T14:32:10"],
    ["photo_2026-08-03_14-32-10.jpg", "2026-08-03T14:32:10"],
    ["signal-2026-08-03-143210.jpg", "2026-08-03T14:32:10"],
    ["signal-2026-08-03-14-32-10-123.jpg", "2026-08-03T14:32:10"],
    ["2026-08-03 14.32.10.jpg", "2026-08-03T14:32:10"],
  ])("%s → %s", (nom, attendu) => {
    expect(d(nom)).toEqual({ priseLocale: attendu, avecHeure: true });
  });

  it("sans heure, garde le jour (à midi)", () => {
    expect(d("IMG-20260803-WA0001.jpg")).toEqual({ priseLocale: "2026-08-03T12:00:00", avecHeure: false });
    expect(d("VID-20260803-WA0002.mp4")).toEqual({ priseLocale: "2026-08-03T12:00:00", avecHeure: false });
    expect(d("Naxos 2026-08-03.jpg")).toEqual({ priseLocale: "2026-08-03T12:00:00", avecHeure: false });
  });

  it("ignore ce qui n'est pas une date de prise de vue", () => {
    expect(d("IMG_1234.HEIC")).toBeNull();
    expect(d("DSCF0042.JPG")).toBeNull();
    expect(d("Capture.png")).toBeNull();
    expect(d("IMG_20260231_120000.jpg")).toBeNull(); // 31 février
    expect(d("IMG_20271225_120000.jpg")).toBeNull(); // dans le futur
    expect(d("123202608031234.jpg")).toBeNull(); // chiffres collés : pas une date
    expect(d("photo_1691064730.jpg")).toBeNull();
  });
});
