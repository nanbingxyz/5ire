CREATE TYPE "public"."prompt_merge_strategy" AS ENUM('merge', 'replace', 'scoped');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"name" varchar(300) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"name" varchar(300) NOT NULL,
	"role_definition" varchar,
	"instruction_template" varchar NOT NULL,
	"applicable_models" json,
	"mergeStrategy" "prompt_merge_strategy" DEFAULT 'merge' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"name" varchar(300) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversations_create_time_index" ON "conversations" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "conversations_name_index" ON "conversations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "prompts_create_time_index" ON "prompts" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "prompts_name_index" ON "prompts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "turns_create_time_index" ON "turns" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "workspaces_create_time_index" ON "workspaces" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "workspaces_name_index" ON "workspaces" USING btree ("name");