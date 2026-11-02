"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fileEnvoi } from "@/lib/import/file-envoi";

type Partage = { id: string; fichiers: File[] };

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("clic-clac-partages", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("partages", { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function lirePartage(id: string): Promise<Partage | null> {
  const db = await ouvrir();
  return new Promise((ok) => {
    const r = db.transaction("partages").objectStore("partages").get(id);
    r.onsuccess = () => ok((r.result as Partage) ?? null);
    r.onerror = () => ok(null);
  });
}

async function supprimerPartage(id: string) {
  const db = await ouvrir();
  db.transaction("partages", "readwrite").objectStore("partages").delete(id);
}

/** Photos reçues par « Partager » : on choisit le voyage, puis elles rejoignent la file d'envoi. */
export function RecevoirPartage({ id, voyages }: { id: string; voyages: { slug: string; nom: string }[] }) {
  const router = useRouter();
  const [partage, setPartage] = useState<Partage | null | undefined>(undefined);
  const [choix, setChoix] = useState(voyages[0]?.slug ?? "");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (id) lirePartage(id).then(setPartage);
  }, [id]);

  async function envoyer() {
    if (!partage || !choix) return;
    setEnCours(true);
    await fileEnvoi(choix).ajouter(partage.fichiers, { source: "partage" });
    await supprimerPartage(partage.id);
    router.replace(`/voyages/${choix}/importer`);
  }

  if (!id || partage === null) return <p className="text-encre-douce">Aucun fichier en attente de partage.</p>;
  if (partage === undefined) return <p className="text-encre-douce">Lecture des fichiers partagés…</p>;
  if (!voyages.length) return <p className="text-encre-douce">Vous ne participez encore à aucun voyage.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">
        {partage.fichiers.length} fichier{partage.fichiers.length > 1 ? "s" : ""} à ajouter
      </h1>
      <label className="block space-y-1.5">
        <span className="etiquette">Dans le voyage</span>
        <select className="champ" value={choix} onChange={(e) => setChoix(e.target.value)}>
          {voyages.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.nom}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="bouton w-full" disabled={enCours} onClick={envoyer}>
        {enCours ? "Ajout…" : "Envoyer dans ce voyage"}
      </button>
    </div>
  );
}
