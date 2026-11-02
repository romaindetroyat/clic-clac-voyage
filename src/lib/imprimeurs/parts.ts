/**
 * Commande groupée : coût de chacun (exemplaires + part du port) et « qui doit combien à qui ».
 * Calculs en centimes ; le port d'un envoi groupé est partagé au prorata des exemplaires,
 * les centimes restants allant aux plus gros restes, pour que la somme tombe juste.
 */

export type CommandePersonne = {
  userId: string;
  nom: string;
  exemplaires: number;
  livraison: "groupee" | "domicile";
};

export type Part = {
  userId: string;
  nom: string;
  exemplaires: number;
  livraison: "groupee" | "domicile";
  /** En centimes. */
  livres: number;
  port: number;
  total: number;
  /** Qui avance l'argent n'a rien à rembourser à lui-même. */
  doitA: string | null;
};

export type Recapitulatif = {
  parts: Part[];
  exemplaires: number;
  /** Totaux en centimes. */
  livres: number;
  port: number;
  total: number;
  /** Une ligne par personne qui doit de l'argent. */
  dettes: { de: string; deNom: string; a: string; aNom: string; montant: number }[];
};

const centimes = (euros: number) => Math.round(euros * 100);

/** Répartit `total` centimes selon des poids, en arrondissant au plus gros reste. */
export function repartir(total: number, poids: number[]): number[] {
  const somme = poids.reduce((a, b) => a + b, 0);
  if (!somme) return poids.map(() => 0);
  const bruts = poids.map((p) => (total * p) / somme);
  const parts = bruts.map(Math.floor);
  let reste = total - parts.reduce((a, b) => a + b, 0);
  const ordre = bruts.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordre) {
    if (reste <= 0) break;
    parts[i]++;
    reste--;
  }
  return parts;
}

export function recapitulatif(
  commandes: CommandePersonne[],
  prixExemplaire: number,
  port: (exemplaires: number, sousTotal: number) => number | null,
  payeur: { id: string; nom: string },
): Recapitulatif {
  const actives = commandes.filter((c) => c.exemplaires > 0);
  const prix = centimes(prixExemplaire);
  const groupees = actives.filter((c) => c.livraison === "groupee");
  const nGroupe = groupees.reduce((s, c) => s + c.exemplaires, 0);
  const portGroupe = nGroupe ? centimes(port(nGroupe, (nGroupe * prix) / 100) ?? 0) : 0;
  const partsGroupe = repartir(portGroupe, groupees.map((c) => c.exemplaires));

  const parts: Part[] = actives.map((c) => {
    const livres = c.exemplaires * prix;
    const portPersonne =
      c.livraison === "groupee"
        ? partsGroupe[groupees.indexOf(c)]
        : centimes(port(c.exemplaires, (c.exemplaires * prix) / 100) ?? 0);
    return {
      userId: c.userId,
      nom: c.nom,
      exemplaires: c.exemplaires,
      livraison: c.livraison,
      livres,
      port: portPersonne,
      total: livres + portPersonne,
      doitA: c.userId === payeur.id ? null : payeur.id,
    };
  });

  return {
    parts,
    exemplaires: actives.reduce((s, c) => s + c.exemplaires, 0),
    livres: parts.reduce((s, p) => s + p.livres, 0),
    port: parts.reduce((s, p) => s + p.port, 0),
    total: parts.reduce((s, p) => s + p.total, 0),
    dettes: parts
      .filter((p) => p.doitA && p.total > 0)
      .map((p) => ({ de: p.userId, deNom: p.nom, a: payeur.id, aNom: payeur.nom, montant: p.total })),
  };
}

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const euros = (c: number) => fmt.format(c / 100);
