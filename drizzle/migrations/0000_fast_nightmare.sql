CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"collection_id" uuid NOT NULL,
	"name" varchar(300) NOT NULL,
	"url" varchar(300) NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"error" varchar,
	"mimetype" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"text" varchar NOT NULL,
	"index" integer DEFAULT 0 NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"documentId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "collections_create_time_index" ON "collections" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "collections_name_index" ON "collections" USING btree ("name");--> statement-breakpoint
CREATE INDEX "documents_collection_id_index" ON "documents" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "documents_name_index" ON "documents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "documents_create_time_index" ON "documents" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "documents_url_index" ON "documents" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_collection_id_url_index" ON "documents" USING btree ("collection_id","url");--> statement-breakpoint
CREATE INDEX "document_chunks_create_time_index" ON "document_chunks" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_index" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunks_documentId_index_index" ON "document_chunks" USING btree ("documentId","index");