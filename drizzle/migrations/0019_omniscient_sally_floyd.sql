DROP INDEX "conversation_collections_conversation_id_index";--> statement-breakpoint
DROP INDEX "conversation_collections_conversation_id_collection_id_index";--> statement-breakpoint
ALTER TABLE "turns" ALTER COLUMN "metadata" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "model" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "system_prompt" varchar;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "error" varchar;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE set null;--> statement-breakpoint
ALTER TABLE "conversation_collections" DROP COLUMN "conversation_id";