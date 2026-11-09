ALTER TABLE "media" ADD COLUMN "masque" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "rang" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "remplacee" boolean DEFAULT false NOT NULL;