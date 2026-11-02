/** Espace occupé par un voyage (ou toute l'application), pour suivre le coût d'hébergement. */
import { and, eq, sql } from "drizzle-orm";
import { VERSION_VIDEO_OCTETS_PAR_SECONDE, VERSIONS_PHOTO_OCTETS, type Usage } from "@/lib/couts/estimation";
import type { Db } from "../db/client";
import { media } from "../db/schema";

export async function usage(db: Db, voyageId?: string): Promise<Usage> {
  const condition = voyageId ? and(eq(media.voyageId, voyageId), eq(media.statut, "pret")) : eq(media.statut, "pret");
  const [r] = await db
    .select({
      photos: sql<number>`count(*) filter (where ${media.type} = 'photo')::int`,
      videos: sql<number>`count(*) filter (where ${media.type} = 'video')::int`,
      octets: sql<number>`coalesce(sum(${media.taille}), 0)::float8`,
      secondes: sql<number>`coalesce(sum(${media.dureeSecondes}) filter (where ${media.type} = 'video'), 0)::float8`,
    })
    .from(media)
    .where(condition);
  let octetsBase: number | null = null;
  if (!voyageId) {
    try {
      const res = (await db.execute(sql`select pg_database_size(current_database())::float8 as n`)) as unknown as
        | { rows?: { n: number }[] }
        | { n: number }[];
      const lignes = Array.isArray(res) ? res : (res.rows ?? []);
      octetsBase = lignes[0] ? Number(lignes[0].n) : null;
    } catch {
      octetsBase = null;
    }
  }
  return {
    photos: r.photos,
    videos: r.videos,
    octetsOriginaux: Number(r.octets),
    octetsVersions: r.photos * VERSIONS_PHOTO_OCTETS + Number(r.secondes) * VERSION_VIDEO_OCTETS_PAR_SECONDE,
    octetsBase,
  };
}
