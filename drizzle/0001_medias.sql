CREATE TYPE "public"."source_media" AS ENUM('fichier', 'partage', 'whatsapp', 'google-photos', 'google-drive', 'dropbox', 'onedrive', 'raccourci-ios');--> statement-breakpoint
CREATE TYPE "public"."statut_media" AS ENUM('envoi', 'pret', 'erreur');--> statement-breakpoint
CREATE TYPE "public"."type_media" AS ENUM('photo', 'video');--> statement-breakpoint
CREATE TABLE "appareil" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"cle" text NOT NULL,
	"libelle" text NOT NULL,
	"proprietaire_id" text,
	"decalage_secondes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"auteur_id" text,
	"appareil_id" text,
	"type" "type_media" NOT NULL,
	"statut" "statut_media" DEFAULT 'envoi' NOT NULL,
	"source" "source_media" DEFAULT 'fichier' NOT NULL,
	"nom_fichier" text NOT NULL,
	"mime" text NOT NULL,
	"taille" bigint NOT NULL,
	"sha256" text NOT NULL,
	"dhash" text,
	"largeur" integer,
	"hauteur" integer,
	"duree_secondes" double precision,
	"prise_locale" text,
	"decalage_exif_minutes" integer,
	"prise_utc" timestamp with time zone,
	"latitude" double precision,
	"longitude" double precision,
	"cle_original" text NOT NULL,
	"envoi_id" text,
	"versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"copie_compressee" boolean DEFAULT false NOT NULL,
	"doublon_de" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voyage" ADD COLUMN "fuseau" text DEFAULT 'Europe/Paris' NOT NULL;--> statement-breakpoint
ALTER TABLE "appareil" ADD CONSTRAINT "appareil_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appareil" ADD CONSTRAINT "appareil_proprietaire_id_user_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_appareil_id_appareil_id_fk" FOREIGN KEY ("appareil_id") REFERENCES "public"."appareil"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appareil_voyage_cle_unique" ON "appareil" USING btree ("voyage_id","cle");--> statement-breakpoint
CREATE INDEX "media_voyage_prise_idx" ON "media" USING btree ("voyage_id","prise_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "media_voyage_sha_unique" ON "media" USING btree ("voyage_id","sha256");