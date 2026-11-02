CREATE TYPE "public"."statut_maj_imprimeur" AS ENUM('proposee', 'validee', 'rejetee');--> statement-breakpoint
CREATE TYPE "public"."usage_ia" AS ENUM('rafale', 'imprimeur');--> statement-breakpoint
CREATE TABLE "depense_ia" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text,
	"usage" "usage_ia" NOT NULL,
	"mois" text NOT NULL,
	"cout_micro_usd" bigint NOT NULL,
	"jetons_entree" integer DEFAULT 0 NOT NULL,
	"jetons_sortie" integer DEFAULT 0 NOT NULL,
	"recherches" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maj_imprimeur" (
	"id" text PRIMARY KEY NOT NULL,
	"imprimeur_id" text NOT NULL,
	"statut" "statut_maj_imprimeur" DEFAULT 'proposee' NOT NULL,
	"propositions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resume" text,
	"demande_par" text,
	"verifie_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rafale_ia" (
	"voyage_id" text NOT NULL,
	"rafale_id" text NOT NULL,
	"media_id" text,
	"raison" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rafale_ia_voyage_id_rafale_id_pk" PRIMARY KEY("voyage_id","rafale_id")
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "choix_manuel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "depense_ia" ADD CONSTRAINT "depense_ia_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maj_imprimeur" ADD CONSTRAINT "maj_imprimeur_demande_par_user_id_fk" FOREIGN KEY ("demande_par") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rafale_ia" ADD CONSTRAINT "rafale_ia_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "depense_ia_mois_idx" ON "depense_ia" USING btree ("mois");--> statement-breakpoint
CREATE INDEX "maj_imprimeur_idx" ON "maj_imprimeur" USING btree ("imprimeur_id","statut");