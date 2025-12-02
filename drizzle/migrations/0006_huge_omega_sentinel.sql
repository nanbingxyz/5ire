CREATE TYPE "public"."provider_kind" AS ENUM('openai', 'openai-compatible', 'anthropic', 'cohere', 'google', 'azure', 'baidu', 'doubao', 'grok', '302-ai', 'zhipu', 'perplexity', 'moonshot', 'ollama', 'lm-studio', 'mistral', 'deepseek');--> statement-breakpoint
CREATE TYPE "public"."turn_finish_reason" AS ENUM('length', 'stop', 'content-filter', 'tool-calls', 'error', 'unrecognized', 'unknown');--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"kind" "provider_kind" NOT NULL,
	"label" varchar(300) NOT NULL,
	"remark" varchar(300),
	"config" json NOT NULL,
	"projectId" uuid
);
--> statement-breakpoint
CREATE TABLE "usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"providerId" uuid NOT NULL,
	"model" varchar(300) NOT NULL,
	"input" integer DEFAULT 0 NOT NULL,
	"output" integer DEFAULT 0 NOT NULL,
	"cached_input" integer DEFAULT 0 NOT NULL,
	"reasoning" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" RENAME TO "projects";--> statement-breakpoint
ALTER TABLE "conversations" RENAME COLUMN "name" TO "summary";--> statement-breakpoint
ALTER TABLE "prompts" RENAME COLUMN "role_definition" TO "role_definition_template";--> statement-breakpoint
DROP INDEX "conversations_name_index";--> statement-breakpoint
DROP INDEX "workspaces_create_time_index";--> statement-breakpoint
DROP INDEX "workspaces_name_index";--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "system_prompt" varchar;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "config" json NOT NULL;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "metadata" json;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "prompt" json NOT NULL;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "conversation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "finish_reason" "turn_finish_reason" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "reply" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "usage" json NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "config" json NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "usages" ADD CONSTRAINT "usages_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "providers_create_time_index" ON "providers" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "providers_label_index" ON "providers" USING btree ("label");--> statement-breakpoint
CREATE INDEX "usages_create_time_index" ON "usages" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "usages_providerId_index" ON "usages" USING btree ("providerId");--> statement-breakpoint
CREATE UNIQUE INDEX "usages_providerId_model_index" ON "usages" USING btree ("providerId","model");--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "projects_create_time_index" ON "projects" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "projects_name_index" ON "projects" USING btree ("name");--> statement-breakpoint
ALTER TABLE "prompts" DROP COLUMN "applicable_models";