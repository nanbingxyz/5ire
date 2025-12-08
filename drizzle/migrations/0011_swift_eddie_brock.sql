ALTER TABLE "servers" ALTER COLUMN "transport" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."server_transport";--> statement-breakpoint
CREATE TYPE "public"."server_transport" AS ENUM('stdio', 'http-streamable');--> statement-breakpoint
ALTER TABLE "servers" ALTER COLUMN "transport" SET DATA TYPE "public"."server_transport" USING "transport"::"public"."server_transport";