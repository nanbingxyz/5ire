ALTER TABLE "prompts" RENAME COLUMN "mergeStrategy" TO "merge_strategy";--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "legacy_id" varchar(300);--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_legacy_id_index" ON "prompts" USING btree ("legacy_id") WHERE "prompts"."legacy_id" is not null;