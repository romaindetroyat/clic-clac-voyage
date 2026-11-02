/**
 * Polices des thèmes du site. Pas de préchargement : le navigateur ne télécharge
 * que les fichiers de la paire choisie, au moment où le texte s'affiche.
 * (EB Garamond et Inter viennent de la mise en page racine.)
 */
import { DM_Sans, DM_Serif_Display, Fraunces, Lora, Nunito_Sans, Playfair_Display, Source_Sans_3, Space_Grotesk, Work_Sans } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-playfair", weight: ["400", "500"] });
const source = Source_Sans_3({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-source" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-fraunces", weight: ["400", "500"] });
const worksans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-worksans" });
const dmserif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dmserif", weight: "400" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dmsans" });
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-grotesk", weight: ["400", "500"] });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-lora", weight: ["400", "500"] });
const nunito = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-nunito" });

export const classesPolices = [playfair, source, fraunces, worksans, dmserif, dmsans, grotesk, lora, nunito]
  .map((p) => p.variable)
  .join(" ");
