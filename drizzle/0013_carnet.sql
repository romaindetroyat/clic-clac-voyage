ALTER TABLE "episode" ALTER COLUMN "presentation" SET DEFAULT 'carnet';--> statement-breakpoint
UPDATE "episode" SET "presentation" = 'carnet' WHERE "presentation" = 'mosaique';
