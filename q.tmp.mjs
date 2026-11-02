import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(".data/e2e/db");
const r = await db.query(`select nom_fichier, prise_utc, appareil_id, dhash, nettete, doublon_de is not null as dbl, rafale_id from media m join voyage v on v.id=m.voyage_id where v.slug='rafales'`);
console.table(r.rows);
