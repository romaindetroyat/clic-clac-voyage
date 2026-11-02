import { sql } from "drizzle-orm";
import {
  bigint,
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
