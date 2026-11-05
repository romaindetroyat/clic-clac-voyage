"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { economieDonnees, fileEnvoi, type Element } from "@/lib/import/file-envoi";
import { dateDepuisNom, estMediaWhatsapp, lireDiscussion } from "@/lib/import/whatsapp";
import { extraireZip, lireTexteZip } from "@/lib/import/zip";
import { fichiersDepuisDepot } from "./dossiers";

const ACCEPT =
  ".zip,image/*,video/*,.heic,.heif,.hif,.dng,.cr2,.cr3,.nef,.nrw,.arw,.raf,.orf,.rw2,.pef,.srw,.mov,.mp4,.m4v";

function useEnLigne() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function taille(o: number) {
  if (o < 1024 * 1024) return `${Math.max(1, Math.round(o / 1024))} Ko`;
  if (o < 1024 ** 3) return `${(o / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
  return `${(o / 1024 ** 3).toFixed(2).replace(".", ",")} Go`;
}

const LIBELLE: Record<Element["etat"], string> = {
  attente: "En attente",
  analyse: "Préparation",
  envoi: "Envoi",
  termine: "Envoyé",
  doublon: "Déjà dans le voyage",
  erreur: "Erreur",
};

export function Importeur({ voyage, remiseAZero = 0, dansLeVoyage }: { voyage: string; remiseAZero?: number; dansLeVoyage?: number }) {
  const file = useMemo(() => fileEnvoi(voyage, remiseAZero), [voyage, remiseAZero]);
  const [elements, setElements] = useState<Element[]>([]);
  const [survol, setSurvol] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enReseau = useEnLigne();
  const choix = useRef<HTMLInputElement>(null);
  const dossier = useRef<HTMLInputElement>(null);

  useEffect(() => file.abonner(setElements), [file]);

  async function ajouter(tous: File[]) {
    const archives = tous.filter((f) => f.name.toLowerCase().endsWith(".zip"));
    const fichiers = tous.filter((f) => !f.name.toLowerCase().endsWith(".zip"));
    for (const zip of archives) await importerWhatsapp(zip);
    if (!fichiers.length) return;
    const { ajoutes, ignores } = await file.ajouter(fichiers);
    setMessage(
      `${ajoutes} fichier${ajoutes > 1 ? "s" : ""} ajouté${ajoutes > 1 ? "s" : ""} à l’envoi` +
        (ignores ? ` (${ignores} ignoré${ignores > 1 ? "s" : ""} : ni photo ni vidéo)` : "."),
    );
  }

  /** Archive « Exporter la discussion » de WhatsApp : médias + date et auteur tirés du texte. */
  async function importerWhatsapp(zip: File) {
    setMessage(`Lecture de l’archive ${zip.name}…`);
    try {
      const texte = await lireTexteZip(zip, (n) => /\.txt$/i.test(n));
      const infos = texte ? lireDiscussion(texte) : new Map();
      const medias = await extraireZip(zip, (n) => n.endsWith("/") || estMediaWhatsapp(n.split("/").pop() ?? n));
      const dates = new Map(medias.map((m) => [m.name, infos.get(m.name)?.priseLocale ?? dateDepuisNom(m.name)]));
      const { ajoutes } = await file.ajouter(medias, { source: "whatsapp", copieCompressee: true, dates });
      setMessage(
        `${ajoutes} photo${ajoutes > 1 ? "s" : ""} ou vidéo${ajoutes > 1 ? "s" : ""} WhatsApp ajoutée${ajoutes > 1 ? "s" : ""}. ` +
          "Si l’original arrive plus tard, il remplacera automatiquement la copie compressée.",
      );
    } catch {
      setMessage(`Impossible de lire l’archive ${zip.name}.`);
    }
  }

  const stats = useMemo(() => {
    const s = { total: elements.length, termines: 0, doublons: 0, erreurs: 0, actifs: 0, octets: 0, octetsFaits: 0 };
    for (const e of elements) {
      if (e.etat === "termine") s.termines++;
      else if (e.etat === "doublon") s.doublons++;
      else if (e.etat === "erreur") s.erreurs++;
      else s.actifs++;
      if (e.etat !== "doublon" && e.etat !== "erreur") {
        s.octets += e.taille;
        s.octetsFaits += e.etat === "termine" ? e.taille : e.etat === "envoi" ? e.taille * e.progression : 0;
      }
    }
    return s;
  }, [elements]);

  // Envoi terminé : le total du voyage (calculé par le serveur) est relu.
  const router = useRouter();
  const actifsAvant = useRef(stats.actifs);
  useEffect(() => {
    if (actifsAvant.current > 0 && stats.actifs === 0) router.refresh();
    actifsAvant.current = stats.actifs;
  }, [stats.actifs, router]);

  const economie = useSyncExternalStore(
    (cb) => file.abonner(cb),
    () => economieDonnees(),
    () => false,
  );
  const enAttenteWifi = elements.filter((e) => e.etat === "attente" && file.attendWifi(e)).length;

  const visibles = elements.filter((e) => e.etat !== "termine" && e.etat !== "doublon").slice(0, 200);

  return (
    <div className="space-y-8">
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setSurvol(false);
          await ajouter(await fichiersDepuisDepot(e.dataTransfer));
        }}
        className={`flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          survol ? "border-accent bg-papier-2" : "border-filet"
        }`}
      >
        <p className="font-titre text-2xl">Ajoutez vos photos et vidéos</p>
        <p className="max-w-md text-sm text-encre-douce">
          Choisissez-les dans la galerie de votre téléphone, ou glissez ici des fichiers et des dossiers entiers depuis
          votre ordinateur. Les originaux sont conservés en pleine qualité, et les doublons sont écartés. Une discussion
          WhatsApp exportée (fichier .zip) est aussi acceptée.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className="bouton" onClick={() => choix.current?.click()}>
            Choisir des photos et vidéos
          </button>
          <button type="button" className="bouton-discret hidden sm:inline-flex" onClick={() => dossier.current?.click()}>
            Choisir un dossier
          </button>
        </div>
        <input
          ref={choix}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          data-testid="choisir-fichiers"
          onChange={async (e) => {
            await ajouter([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <input
          ref={dossier}
          type="file"
          multiple
          className="sr-only"
          {...{ webkitdirectory: "" }}
          onChange={async (e) => {
            await ajouter([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Link href={`/voyages/${voyage}/importer/aide`} className="lien text-sm">
          iPhone, iCloud, WhatsApp, carte SD : mode d’emploi
        </Link>
        {message ? (
          <p role="status" className="text-sm text-succes">
            {message}
          </p>
        ) : null}
      </section>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={economie}
          onChange={(e) => file.regleEconomie(e.target.checked)}
        />
        <span>
          Économiser les données mobiles
          <span className="block text-encre-douce">
            Les petites photos partent tout de suite ; les vidéos et les gros fichiers attendent le Wi-Fi (ou votre feu
            vert).
          </span>
        </span>
      </label>

      {dansLeVoyage !== undefined ? (
        <p className="text-sm text-encre-douce" data-testid="total-voyage">
          {dansLeVoyage
            ? `Déjà dans le voyage : ${dansLeVoyage} photo${dansLeVoyage > 1 ? "s" : ""} et vidéo${dansLeVoyage > 1 ? "s" : ""} (doublons écartés).`
            : "Aucune photo dans le voyage pour l’instant."}{" "}
          {stats.total > 0 ? "Le bilan ci-dessous ne compte que l’envoi en cours depuis cet appareil." : ""}
        </p>
      ) : null}

      {stats.total > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl">Envoi</h2>
            <p className="text-sm text-encre-douce" data-testid="bilan-envoi">
              {stats.termines} envoyé{stats.termines > 1 ? "s" : ""}
              {stats.doublons ? ` · ${stats.doublons} déjà présent${stats.doublons > 1 ? "s" : ""}` : ""}
              {stats.actifs ? ` · ${stats.actifs} en cours` : ""}
              {stats.erreurs ? ` · ${stats.erreurs} en erreur` : ""}
            </p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-papier-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((stats.octetsFaits / Math.max(1, stats.octets)) * 100)}
          >
            <div className="h-full bg-encre transition-all" style={{ width: `${(stats.octetsFaits / Math.max(1, stats.octets)) * 100}%` }} />
          </div>
          {!enReseau ? (
            <p className="rounded-md border border-filet bg-papier-2 px-3 py-2 text-sm">
              Pas de réseau : l’envoi reprendra tout seul dès le retour de la connexion, même si vous fermez l’app.
            </p>
          ) : stats.actifs ? (
            <p className="text-sm text-encre-douce">
              Sur iPhone, gardez l’app ouverte pendant l’envoi. Si vous la fermez, il reprendra à la prochaine ouverture.
            </p>
          ) : null}

          {enAttenteWifi > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-filet bg-papier-2 px-3 py-2 text-sm">
              <span>
                {enAttenteWifi} fichier{enAttenteWifi > 1 ? "s" : ""} en attente du Wi-Fi
              </span>
              <button type="button" className="lien" onClick={() => file.envoyerToutMaintenant()}>
                Envoyer maintenant
              </button>
            </div>
          ) : null}

          {visibles.length ? (
            <ul className="divide-y divide-filet border-y border-filet">
              {visibles.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{e.nom}</p>
                    <p className={`text-xs ${e.etat === "erreur" ? "text-danger" : "text-encre-douce"}`}>
                      {e.etat === "attente" && file.attendWifi(e) ? "Attend le Wi-Fi" : LIBELLE[e.etat]}
                      {e.etat === "envoi" || e.etat === "analyse" ? ` · ${Math.round(e.progression * 100)} %` : ""} ·{" "}
                      {taille(e.taille)}
                      {e.erreur && e.etat !== "termine" ? ` · ${e.erreur}` : ""}
                    </p>
                  </div>
                  {e.etat === "erreur" ? (
                    <button type="button" className="min-h-11 px-2 text-sm text-encre-douce hover:text-encre" onClick={() => file.reessayer(e.id)}>
                      Réessayer
                    </button>
                  ) : null}
                  {e.etat === "attente" || e.etat === "erreur" ? (
                    <button type="button" className="min-h-11 px-2 text-sm text-danger" onClick={() => file.annuler(e.id)}>
                      Retirer
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href={`/voyages/${voyage}/photos`} className="bouton-discret">
              Voir les photos
            </Link>
            {stats.termines + stats.doublons > 0 ? (
              <button type="button" className="bouton-discret" onClick={() => file.retirerTermines()}>
                Effacer la liste des fichiers envoyés
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
