ALTER TABLE "episode" ADD COLUMN "presentation" text DEFAULT 'mosaique' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "vedette" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voyage" ADD COLUMN "site" jsonb;