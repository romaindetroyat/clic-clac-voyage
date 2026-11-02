CREATE TYPE "public"."livraison_commande" AS ENUM('groupee', 'domicile');--> statement-breakpoint
CREATE TYPE "public"."statut_commande" AS ENUM('demandee', 'commandee', 'expediee');--> statement-breakpoint
CREATE TABLE "commande_livre" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"user_id" text NOT NULL,
	"exemplaires" integer DEFAULT 1 NOT NULL,
	"livraison" "livraison_commande" DEFAULT 'groupee' NOT NULL,
	"adresse" text,
	"statut" "statut_commande" DEFAULT 'demandee' NOT NULL,
	"paye" boolean DEFAULT false NOT NULL,
	"montant_fige" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "livre" ADD COLUMN "payeur_id" text;--> statement-breakpoint
ALTER TABLE "commande_livre" ADD CONSTRAINT "commande_livre_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_livre" ADD CONSTRAINT "commande_livre_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commande_voyage_user_unique" ON "commande_livre" USING btree ("voyage_id","user_id");--> statement-breakpoint
ALTER TABLE "livre" ADD CONSTRAINT "livre_payeur_id_user_id_fk" FOREIGN KEY ("payeur_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;