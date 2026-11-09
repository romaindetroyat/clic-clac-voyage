/** Jour (AAAA-MM-JJ) et heure (HH:MM) d'un instant dans un fuseau donné. */
export function jourHeure(iso: string | null, fuseau: string) {
  if (!iso) return { jour: "", heure: "12:00" };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

/** « Lundi 3 août » pour un jour AAAA-MM-JJ. */
export function libelleJour(jour: string) {
  const t = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Jours du voyage : ceux de ses dates de début et de fin, et ceux où des photos ont été prises. */
export function joursDuVoyage(instants: (string | null)[], fuseau: string, debut?: string | null, fin?: string | null): string[] {
  const jours = new Set(instants.filter((x): x is string => !!x).map((x) => jourHeure(x, fuseau).jour));
  if (debut && fin && debut <= fin) {
    for (let t = Date.parse(`${debut}T12:00:00Z`); t <= Date.parse(`${fin}T12:00:00Z`); t += 86_400_000) jours.add(new Date(t).toISOString().slice(0, 10));
  }
  return [...jours].sort();
}
