import { describe, expect, it } from "vitest";
import { dateDepuisNom, lireDiscussion } from "@/lib/import/whatsapp";

describe("archive WhatsApp", () => {
  it("lit une discussion exportée depuis un iPhone", () => {
    const t = [
      "[03/08/2026 14:05:12] Paul Martin: Regardez ce coucher de soleil",
      "[03/08/2026 14:05:12] Paul Martin: ‎<pièce jointe : 00000012-PHOTO-2026-08-03-14-05-12.jpg>",
      "[04/08/2026 09:01:44] Léa: ‎<attached: 00000013-VIDEO-2026-08-04-09-01-44.mp4>",
    ].join("\n");
    const m = lireDiscussion(t);
    expect(m.get("00000012-PHOTO-2026-08-03-14-05-12.jpg")).toEqual({ auteur: "Paul Martin", priseLocale: "2026-08-03T14:05:12" });
    expect(m.get("00000013-VIDEO-2026-08-04-09-01-44.mp4")?.auteur).toBe("Léa");
    expect(m.size).toBe(2);
  });

  it("lit une discussion exportée depuis Android", () => {
    const t = [
      "03/08/2026 14:05 - Paul: IMG-20260803-WA0001.jpg (fichier joint)",
      "03/08/2026 14:07 - Les messages sont chiffrés de bout en bout.",
      "04/08/26, 21:30 - Léa: VID-20260804-WA0002.mp4 (file attached)",
    ].join("\n");
    const m = lireDiscussion(t);
    expect(m.get("IMG-20260803-WA0001.jpg")).toEqual({ auteur: "Paul", priseLocale: "2026-08-03T14:05:00" });
    expect(m.get("VID-20260804-WA0002.mp4")?.priseLocale).toBe("2026-08-04T21:30:00");
  });

  it("gère le format anglais avec AM/PM", () => {
    const m = lireDiscussion("8/13/26, 9:05 PM - Tom: IMG-20260813-WA0003.jpg (file attached)");
    expect(m.get("IMG-20260813-WA0003.jpg")?.priseLocale).toBe("2026-08-13T21:05:00");
  });

  it("tire une date du nom de fichier en dernier recours", () => {
    expect(dateDepuisNom("00000012-PHOTO-2026-08-03-14-05-12.jpg")).toBe("2026-08-03T14:05:12");
    expect(dateDepuisNom("IMG-20260803-WA0001.jpg")).toBe("2026-08-03T12:00:00");
    expect(dateDepuisNom("photo.jpg")).toBeNull();
  });
});
