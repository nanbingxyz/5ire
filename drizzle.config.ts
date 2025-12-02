import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  out: "./drizzle/migrations",
  schema: ["./src/main/database/schema/tables.ts", "./src/main/database/schema/relations.ts"],
});
