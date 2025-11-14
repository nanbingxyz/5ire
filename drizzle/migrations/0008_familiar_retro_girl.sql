CREATE TYPE "public"."server_approval_policy" AS ENUM('always', 'never', 'once');--> statement-breakpoint
CREATE TYPE "public"."server_transport" AS ENUM('stdio', 'sse', 'http-streamable');--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"create_time" timestamp DEFAULT now() NOT NULL,
	"update_time" timestamp DEFAULT now() NOT NULL,
	"label" varchar(300) NOT NULL,
	"description" varchar(300),
	"transport" "server_transport" NOT NULL,
	"endpoint" varchar(600) NOT NULL,
	"config" jsonb NOT NULL,
	"projectId" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"approvalPolicy" "server_approval_policy" DEFAULT 'once' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "servers_create_time_index" ON "servers" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "servers_projectId_index" ON "servers" USING btree ("projectId");