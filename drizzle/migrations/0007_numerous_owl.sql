ALTER TABLE "conversations" ALTER COLUMN "config" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "config" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "config" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "turns" ALTER COLUMN "metadata" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "turns" ALTER COLUMN "prompt" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "turns" ALTER COLUMN "reply" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "turns" ALTER COLUMN "reply" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "turns" ALTER COLUMN "usage" SET DATA TYPE jsonb;