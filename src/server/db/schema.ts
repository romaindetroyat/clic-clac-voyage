import { sql } from "drizzle-orm";
import {
  bigint,
  doublePrecision,
  jsonb,
  boolean,
  integer,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const horodatage = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Tables de Better Auth (noms de champs imposés par la bibliothèque)  */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...horodatage,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...horodatage,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...horodatage,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...horodatage,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Limitation de débit partagée entre les instances serverless. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Voyages, participants, invitations, liens secrets                   */
/* ------------------------------------------------------------------ */

export const roleVoyage = pgEnum("role_voyage", ["admin", "contributeur"]);

export const voyage = pgTable("voyage", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nom: text("nom").notNull(),
  dateDebut: date("date_debut"),
  dateFin: date("date_fin"),
  // Fuseau par défaut des photos sans fuseau dans leur EXIF (IANA, ex. « Europe/Athens »).
  fuseau: text("fuseau").notNull().default("Europe/Paris"),
  // Configuration du site (thème, sections…) : voir src/lib/site/config.ts.
  site: jsonb("site").$type<Record<string, unknown>>(),
  creePar: text("cree_par").references(() => user.id, { onDelete: "set null" }),
  ...horodatage,
});

export const participant = pgTable(
  "participant",
  {
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleVoyage("role").notNull(),
    ...horodatage,
  },
  (t) => [primaryKey({ columns: [t.voyageId, t.userId] }), index("participant_user_idx").on(t.userId)],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: roleVoyage("role").notNull(),
    invitePar: text("invite_par").references(() => user.id, { onDelete: "set null" }),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    accepteeLe: timestamp("acceptee_le", { withTimezone: true }),
    annuleeLe: timestamp("annulee_le", { withTimezone: true }),
    ...horodatage,
  },
  (t) => [
    index("invitation_email_idx").on(t.email),
    // Une seule invitation en attente par adresse et par voyage.
    uniqueIndex("invitation_en_attente_unique")
      .on(t.voyageId, t.email)
      .where(sql`${t.accepteeLe} is null and ${t.annuleeLe} is null`),
  ],
);

export const lienSecret = pgTable(
  "lien_secret",
  {
    id: text("id").primaryKey(),
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    libelle: text("libelle").notNull(),
    // Empreinte SHA-256 du jeton : le jeton lui-même n'est jamais stocké.
    jetonEmpreinte: text("jeton_empreinte").notNull().unique(),
    // Empreinte scrypt du mot de passe facultatif.
    motDePasse: text("mot_de_passe"),
    creePar: text("cree_par").references(() => user.id, { onDelete: "set null" }),
    revoqueLe: timestamp("revoque_le", { withTimezone: true }),
    ...horodatage,
  },
  (t) => [index("lien_secret_voyage_idx").on(t.voyageId)],
);

export type Role = (typeof roleVoyage.enumValues)[number];
export type Voyage = typeof voyage.$inferSelect;

/* ------------------------------------------------------------------ */
/* Médias (photos et vidéos) et appareils                              */
/* ------------------------------------------------------------------ */

export const typeMedia = pgEnum("type_media", ["photo", "video"]);
export const statutMedia = pgEnum("statut_media", ["envoi", "pret", "erreur"]);
export const sourceMedia = pgEnum("source_media", [
  "fichier",
  "partage",
  "whatsapp",
  "google-photos",
  "google-drive",
  "dropbox",
  "onedrive",
  "raccourci-ios",
]);

/** Épisode du voyage : un jour, une étape, un événement. */
export const episode = pgTable(
  "episode",
  {
    id: text("id").primaryKey(),
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull(),
    titre: text("titre").notNull(),
    lieu: text("lieu"),
    recit: text("recit"),
    debut: timestamp("debut", { withTimezone: true }),
    fin: timestamp("fin", { withTimezone: true }),
    // Présentation dans le site : mosaïque, plein écran, défilement, alterné, photo vedette.
    presentation: text("presentation").notNull().default("mosaique"),
    ...horodatage,
  },
  (t) => [index("episode_voyage_idx").on(t.voyageId, t.ordre)],
);

/**
 * Un appareil photo ou téléphone, par voyage : sert au recalage d'horloge.
 * La clé vient de l'EXIF (marque|modèle|numéro de série) ou, à défaut, de la personne qui importe.
 */
export const appareil = pgTable(
  "appareil",
  {
    id: text("id").primaryKey(),
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    cle: text("cle").notNull(),
    libelle: text("libelle").notNull(),
    proprietaireId: text("proprietaire_id").references(() => user.id, { onDelete: "set null" }),
    // Décalage à AJOUTER à l'heure de l'appareil pour obtenir l'heure réelle.
    decalageSecondes: integer("decalage_secondes").notNull().default(0),
    ...horodatage,
  },
  (t) => [uniqueIndex("appareil_voyage_cle_unique").on(t.voyageId, t.cle)],
);

/** Versions web : s, m, l (sans retouche), rs, rm, rl (retouchées, « cuites »), affiche et vidéo allégée. */
export type VersionsWeb = Partial<Record<"s" | "m" | "l" | "rs" | "rm" | "rl" | "affiche" | "video", string>>;

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    auteurId: text("auteur_id").references(() => user.id, { onDelete: "set null" }),
    appareilId: text("appareil_id").references(() => appareil.id, { onDelete: "set null" }),
    type: typeMedia("type").notNull(),
    statut: statutMedia("statut").notNull().default("envoi"),
    source: sourceMedia("source").notNull().default("fichier"),

    nomFichier: text("nom_fichier").notNull(),
    mime: text("mime").notNull(),
    taille: bigint("taille", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    // Empreinte perceptuelle 64 bits (hex) : retrouve une même photo recompressée (WhatsApp…).
    dhash: text("dhash"),
    largeur: integer("largeur"),
    hauteur: integer("hauteur"),
    dureeSecondes: doublePrecision("duree_secondes"),

    // Heure de prise de vue telle que l'appareil l'a notée (sans fuseau), et le fuseau s'il est connu.
    priseLocale: text("prise_locale"),
    decalageExifMinutes: integer("decalage_exif_minutes"),
    // Instant UTC avant recalage : priseLocale interprétée dans son fuseau (ou celui du voyage).
    priseUtc: timestamp("prise_utc", { withTimezone: true }),

    // Position précise : privée, jamais exposée publiquement.
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    cleOriginal: text("cle_original").notNull(),
    // Envoi multipart en cours (reprise après coupure).
    envoiId: text("envoi_id"),
    versions: jsonb("versions").$type<VersionsWeb>().notNull().default({}),

    // Copie compressée (WhatsApp, mode économie de données) en attente de son original.
    copieCompressee: boolean("copie_compressee").notNull().default(false),
    // Masqué car doublon d'un autre média de meilleure qualité.
    doublonDe: text("doublon_de"),

    // Retouche non destructive (paramètres) ; l'original n'est jamais modifié.
    retouche: jsonb("retouche").$type<Record<string, unknown>>(),

    // Qualité estimée dans le navigateur (0 à 1) et rafales
    nettete: doublePrecision("nettete"),
    exposition: doublePrecision("exposition"),
    rafaleId: text("rafale_id"),
    // Photo retenue dans sa rafale (proposée automatiquement, modifiable d'un clic).
    choixRafale: boolean("choix_rafale").notNull().default(false),

    // Récit et sélection
    episodeId: text("episode_id").references(() => episode.id, { onDelete: "set null" }),
    legende: text("legende"),
    dansSite: boolean("dans_site").notNull().default(true),
    dansLivre: boolean("dans_livre").notNull().default(true),
    // Mise en avant dans le site (photo vedette d'un épisode, plus grande dans les mosaïques).
    vedette: boolean("vedette").notNull().default(false),
    ...horodatage,
  },
  (t) => [
    index("media_voyage_prise_idx").on(t.voyageId, t.priseUtc),
    uniqueIndex("media_voyage_sha_unique").on(t.voyageId, t.sha256),
  ],
);

export type Media = typeof media.$inferSelect;

/* ------------------------------------------------------------------ */
/* Commentaires et réactions                                           */
/* ------------------------------------------------------------------ */

export const commentaire = pgTable(
  "commentaire",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    auteurId: text("auteur_id").references(() => user.id, { onDelete: "set null" }),
    texte: text("texte").notNull(),
    ...horodatage,
  },
  (t) => [index("commentaire_media_idx").on(t.mediaId)],
);

export const reaction = pgTable(
  "reaction",
  {
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.userId, t.emoji] })],
);

export type Episode = typeof episode.$inferSelect;

/* ------------------------------------------------------------------ */
/* Livre photo                                                         */
/* ------------------------------------------------------------------ */

/** Un livre par voyage : son contenu courant (voir src/lib/livre/modele.ts). */
export const livre = pgTable("livre", {
  voyageId: text("voyage_id")
    .primaryKey()
    .references(() => voyage.id, { onDelete: "cascade" }),
  contenu: jsonb("contenu").$type<Record<string, unknown>>().notNull(),
  // Incrémentée à chaque enregistrement : détecte deux éditions simultanées.
  revision: integer("revision").notNull().default(1),
  modifiePar: text("modifie_par").references(() => user.id, { onDelete: "set null" }),
  ...horodatage,
});

/** Historique des versions du livre, pour revenir en arrière. */
export const versionLivre = pgTable(
  "version_livre",
  {
    id: text("id").primaryKey(),
    voyageId: text("voyage_id")
      .notNull()
      .references(() => voyage.id, { onDelete: "cascade" }),
    libelle: text("libelle").notNull(),
    contenu: jsonb("contenu").$type<Record<string, unknown>>().notNull(),
    creePar: text("cree_par").references(() => user.id, { onDelete: "set null" }),
    ...horodatage,
  },
  (t) => [index("version_livre_voyage_idx").on(t.voyageId, t.createdAt)],
);
