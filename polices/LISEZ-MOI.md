# Polices du livre

Polices embarquées dans les PDF du livre photo, sous licence SIL Open Font License 1.1
(fichiers `OFL-*.txt`) ou Apache 2.0 (`LICENCE-specialelite.txt`) : usage, embarquement et sous-ensemble autorisés.
Toutes viennent de google/fonts.

- `EBGaramond.ttf`, `EBGaramond-Italique.ttf` : EB Garamond (`ofl/ebgaramond`).
- `Inter.ttf` : Inter (`ofl/inter`).
- Styles du livre (`src/lib/livre/styles.ts`) : Caveat, Kalam, Reenie Beanie, Dancing Script, Amatic SC,
  Special Elite, Courier Prime, Playfair Display (+ italique), Cormorant Garamond (+ italique),
  Libre Baskerville (+ italique), DM Serif Display, Abril Fatface, Josefin Sans, Space Grotesk, Bebas Neue.

Les polices variables ont été figées à la graisse affichée à l'écran (Caveat et Cormorant en 500, les autres
en 400 ; fontTools `varLib.instancer`) puis réduites à l'alphabet latin (`pyftsubset`) : Typst prendrait sinon
l'instance par défaut du fichier (souvent Thin ou Light). Les mêmes familles et graisses sont chargées à l'écran
par next/font : le texte du PDF et celui de l'aperçu se ressemblent.
