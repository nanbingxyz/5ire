CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"turn_snapshot" jsonb NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bookmarks_create_time_index" ON "bookmarks" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "bookmarks_favorite_index" ON "bookmarks" USING btree ("favorite");