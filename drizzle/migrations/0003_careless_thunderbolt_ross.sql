CREATE TABLE "conversation_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"conversationId" varchar NOT NULL,
	"collectionId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_collections" ADD CONSTRAINT "conversation_collections_collectionId_collections_id_fk" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "conversation_collections_create_time_index" ON "conversation_collections" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "conversation_collections_conversationId_index" ON "conversation_collections" USING btree ("conversationId");