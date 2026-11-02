CREATE TABLE "commentaire" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"auteur_id" text,
	"texte" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"ordre" integer NOT NULL,
	"titre" text NOT NULL,
	"lieu" text,
	"recit" text,
	"debut" timestamp with time zone,
	"fin" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reaction" (
	"media_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_media_id_user_id_emoji_pk" PRIMARY KEY("media_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "episode_id" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "legende" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "dans_site" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "dans_livre" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "commentaire" ADD CONSTRAINT "commentaire_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentaire" ADD CONSTRAINT "commentaire_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode" ADD CONSTRAINT "episode_voyage_id_voyage_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commentaire_media_idx" ON "commentaire" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "episode_voyage_idx" ON "episode" USING btree ("voyage_id","ordre");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE set null ON UPDATE no action;