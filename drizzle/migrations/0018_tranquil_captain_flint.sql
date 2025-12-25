ALTER TABLE "conversation_collections" RENAME COLUMN "conversationId" TO "conversation_id";--> statement-breakpoint
ALTER TABLE "conversation_collections" RENAME COLUMN "collectionId" TO "collection_id";--> statement-breakpoint
ALTER TABLE "document_chunks" RENAME COLUMN "documentId" TO "document_id";--> statement-breakpoint
ALTER TABLE "servers" RENAME COLUMN "projectId" TO "project_id";--> statement-breakpoint
ALTER TABLE "servers" RENAME COLUMN "approvalPolicy" TO "approval_policy";--> statement-breakpoint
ALTER TABLE "usages" RENAME COLUMN "providerId" TO "provider_id";--> statement-breakpoint
ALTER TABLE "conversation_collections" DROP CONSTRAINT "conversation_collections_collectionId_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_documentId_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "servers" DROP CONSTRAINT "servers_projectId_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "usages" DROP CONSTRAINT "usages_providerId_providers_id_fk";
--> statement-breakpoint
DROP INDEX "conversation_collections_conversationId_index";--> statement-breakpoint
DROP INDEX "conversation_collections_conversationId_collectionId_index";--> statement-breakpoint
DROP INDEX "document_chunks_documentId_index_index";--> statement-breakpoint
DROP INDEX "servers_projectId_index";--> statement-breakpoint
DROP INDEX "usages_providerId_index";--> statement-breakpoint
DROP INDEX "usages_providerId_model_index";--> statement-breakpoint
ALTER TABLE "conversation_collections" ADD CONSTRAINT "conversation_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "usages" ADD CONSTRAINT "usages_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "conversation_collections_conversation_id_index" ON "conversation_collections" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_collections_conversation_id_collection_id_index" ON "conversation_collections" USING btree ("conversation_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunks_document_id_index_index" ON "document_chunks" USING btree ("document_id","index");--> statement-breakpoint
CREATE INDEX "servers_project_id_index" ON "servers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "usages_provider_id_index" ON "usages" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usages_provider_id_model_index" ON "usages" USING btree ("provider_id","model");