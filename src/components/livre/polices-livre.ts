/**
 * Polices des styles du livre, à l'écran. Mêmes familles et mêmes graisses que les fichiers de
 * /polices qui servent au PDF. Pas de préchargement : seules les polices affichées sont téléchargées.
 */
import {
  Abril_Fatface,
  Amatic_SC,
  Bebas_Neue,
  Caveat,
  Cormorant_Garamond,
  Courier_Prime,
  Dancing_Script,
  DM_Serif_Display,
  Josefin_Sans,
  Kalam,
  Libre_Baskerville,
  Playfair_Display,
  Reenie_Beanie,
  Space_Grotesk,
  Special_Elite,
} from "next/font/google";

const caveat = Caveat({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-caveat", weight: "500" });
const kalam = Kalam({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-kalam", weight: "400" });
const reenie = Reenie_Beanie({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-reenie", weight: "400" });
const dancing = Dancing_Script({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-dancing", weight: "400" });
const amatic = Amatic_SC({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-amatic", weight: "400" });
const special = Special_Elite({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-special", weight: "400" });
const courier = Courier_Prime({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-courier", weight: "400" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-playfair", weight: "400", style: ["normal", "italic"] });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-cormorant", weight: "500", style: ["normal", "italic"] });
const baskerville = Libre_Baskerville({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-baskerville", weight: "400", style: ["normal", "italic"] });
const dmserif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-dmserif", weight: "400" });
const abril = Abril_Fatface({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-abril", weight: "400" });
const josefin = Josefin_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-josefin", weight: "400" });
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-grotesk", weight: "400" });
const bebas = Bebas_Neue({ subsets: ["latin"], display: "swap", preload: false, variable: "--l-bebas", weight: "400" });

export const classesPolicesLivre = [caveat, kalam, reenie, dancing, amatic, special, courier, playfair, cormorant, baskerville, dmserif, abril, josefin, grotesk, bebas]
  .map((p) => p.variable)
  .join(" ");
