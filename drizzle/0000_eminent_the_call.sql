CREATE TYPE "public"."avoidance" AS ENUM('no-sewing', 'no-mess', 'no-food', 'no-drying', 'kid-friendly-only', 'no-expensive-tools', 'no-glitter', 'ships-well', 'kind-humor', 'no-crude-humor');--> statement-breakpoint
CREATE TYPE "public"."budget_range" AS ENUM('under-10', '10-25', '25-50', '50-plus', 'use-what-i-have');--> statement-breakpoint
CREATE TYPE "public"."comfort_level" AS ENUM('first-time', 'beginner', 'comfortable', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."craft_type" AS ENUM('open', 'crochet', 'knitting', 'sewing', 'paper', 'painting', 'drawing', 'candles', 'soap-bath', 'jewelry', 'cricut', 'wood', 'clay', 'floral', 'upcycled', 'food');--> statement-breakpoint
CREATE TYPE "public"."drying_time" AS ENUM('none', 'short', 'overnight');--> statement-breakpoint
CREATE TYPE "public"."gift_item_kind" AS ENUM('material', 'tool', 'step', 'personalization', 'wrapping', 'supply', 'retailer');--> statement-breakpoint
CREATE TYPE "public"."mess_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."occasion" AS ENUM('birthday', 'thank-you', 'holiday', 'housewarming', 'congratulations', 'get-well', 'funny-gag', 'just-because', 'christmas', 'valentines', 'mothers-day', 'fathers-day', 'anniversary', 'wedding', 'bridal-shower', 'baby-shower', 'teacher-appreciation', 'graduation', 'sympathy-comfort', 'new-job', 'retirement', 'hostess', 'apology', 'encouragement', 'other');--> statement-breakpoint
CREATE TYPE "public"."recipient_type" AS ENUM('partner', 'parent', 'friend', 'child', 'teacher', 'coworker', 'neighbor', 'host', 'hard-to-shop-for', 'other');--> statement-breakpoint
CREATE TYPE "public"."space_needed" AS ENUM('tabletop', 'counter', 'small workspace');--> statement-breakpoint
CREATE TYPE "public"."time_range" AS ENUM('under-30', '1-2-hours', 'one-evening', 'weekend', 'week-plus');--> statement-breakpoint
CREATE TYPE "public"."gift_vibe" AS ENUM('sentimental', 'useful', 'cozy', 'playful', 'elegant', 'impressive', 'funny', 'low-effort', 'personal-private', 'fun-to-open');--> statement-breakpoint
CREATE TABLE "gift_crafts" (
	"gift_id" text NOT NULL,
	"craft" "craft_type" NOT NULL,
	"comfort" "comfort_level",
	"position" integer NOT NULL,
	CONSTRAINT "gift_crafts_gift_id_craft_pk" PRIMARY KEY("gift_id","craft"),
	CONSTRAINT "gift_crafts_position_check" CHECK ("gift_crafts"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "gift_ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recipients" "recipient_type"[] NOT NULL,
	"occasions" "occasion"[] NOT NULL,
	"vibes" "gift_vibe"[] NOT NULL,
	"budget" "budget_range" NOT NULL,
	"time" time_range NOT NULL,
	"avoidances" "avoidance"[] NOT NULL,
	"pattern_notes" jsonb,
	"image" text NOT NULL,
	"best_for" text NOT NULL,
	"mess_level" "mess_level" NOT NULL,
	"space_needed" "space_needed" NOT NULL,
	"drying_time" "drying_time" NOT NULL,
	"ships_well" boolean NOT NULL,
	"kid_friendly" boolean NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_ideas_display_order_check" CHECK ("gift_ideas"."display_order" >= 0),
	CONSTRAINT "gift_ideas_title_check" CHECK (length(trim("gift_ideas"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "gift_items" (
	"gift_id" text NOT NULL,
	"kind" "gift_item_kind" NOT NULL,
	"position" integer NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "gift_items_gift_id_kind_position_pk" PRIMARY KEY("gift_id","kind","position"),
	CONSTRAINT "gift_items_position_check" CHECK ("gift_items"."position" >= 0),
	CONSTRAINT "gift_items_content_check" CHECK (length(trim("gift_items"."content")) > 0)
);
--> statement-breakpoint
ALTER TABLE "gift_crafts" ADD CONSTRAINT "gift_crafts_gift_id_gift_ideas_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift_ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_gift_id_gift_ideas_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift_ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gift_crafts_position_idx" ON "gift_crafts" USING btree ("gift_id","position");--> statement-breakpoint
CREATE INDEX "gift_ideas_published_order_idx" ON "gift_ideas" USING btree ("published","display_order","id");