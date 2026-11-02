CREATE TABLE "livre" (
	"voyage_id" text PRIMARY KEY NOT NULL,
	"contenu" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"modifie_par" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "version_livre" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"libelle" text NOT NULL,
	"contenu" jsonb NOT NULL,
	"cree_par" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "livre" ADD CONSTRAINT "livre_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livre" ADD CONSTRAINT "livre_modifie_par_user_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_livre" ADD CONSTRAINT "version_livre_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_livre" ADD CONSTRAINT "version_livre_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "version_livre_voyage_idx" ON "version_livre" USING btree ("voyage_id","created_at");