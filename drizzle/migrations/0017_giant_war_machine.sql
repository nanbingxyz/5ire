ALTER TABLE "providers" DROP CONSTRAINT "providers_projectId_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "providers" DROP COLUMN "projectId";