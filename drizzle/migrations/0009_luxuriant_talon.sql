ALTER TABLE "collections" ADD COLUMN "legacy_id" varchar(300);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "legacy_id" varchar(300);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "legacy_id" varchar(300);--> statement-breakpoint
CREATE UNIQUE INDEX "collections_legacy_id_index" ON "collections" USING btree ("legacy_id") WHERE "collections"."legacy_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_legacy_id_index" ON "documents" USING btree ("legacy_id") WHERE "documents"."legacy_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunks_legacy_id_index" ON "document_chunks" USING btree ("legacy_id") WHERE "document_chunks"."legacy_id" is not null;