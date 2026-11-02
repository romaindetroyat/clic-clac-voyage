ALTER TABLE "media" ADD COLUMN "nettete" double precision;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "exposition" double precision;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "rafale_id" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "choix_rafale" boolean DEFAULT false NOT NULL;