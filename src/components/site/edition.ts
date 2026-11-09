/**
 * Points d'accroche de l'éditeur visuel du site : le site reste un composant pur (rendu serveur,
 * export hors ligne) ; l'éditeur lui passe ces fonctions pour entourer blocs, photos, légendes
 * et en-têtes de chapitre de ses outils.
 */
import type { ReactNode } from "react";
import type { Bloc, Chapitre, SousPartie } from "@/lib/site/carnet";
import type { MediaSite } from "@/lib/site/types";

export type InfoBloc = { chapitre: Chapitre; partie: SousPartie; index: number; bloc: Bloc };

export type Edition = {
  bloc: (info: InfoBloc, rendu: ReactNode) => ReactNode;
  /** `chapitre` : la photo est l'ouverture de ce chapitre. */
  media: (m: MediaSite, rendu: ReactNode, o: { ouverture?: Chapitre }) => ReactNode;
  legende: (m: MediaSite, rendu: ReactNode) => ReactNode;
  chapitre: (c: Chapitre, rendu: ReactNode) => ReactNode;
  /** Après le dernier bloc d'une partie (zone de dépôt, ajout). */
  finPartie: (c: Chapitre, p: SousPartie) => ReactNode;
};
