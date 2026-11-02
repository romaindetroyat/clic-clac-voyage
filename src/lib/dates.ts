const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const fmtCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

function parse(d: string) {
  return new Date(`${d}T12:00:00Z`);
}

/** « du 3 au 17 août 2026 », « 12 juillet 2026 », ou null. */
export function periode(debut?: string | null, fin?: string | null): string | null {
  if (debut && fin && debut !== fin) {
    const memeAnnee = debut.slice(0, 4) === fin.slice(0, 4);
    return `du ${(memeAnnee ? fmtCourt : fmt).format(parse(debut))} au ${fmt.format(parse(fin))}`;
  }
  const seule = debut || fin;
  return seule ? fmt.format(parse(seule)) : null;
}
