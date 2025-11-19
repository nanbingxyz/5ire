import { desc, eq } from "drizzle-orm";
import { Database } from "@/main/database";
import type { PromptInsert } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

export class PromptManager {
  #database = Container.inject(Database);
  #logger = Container.inject(Logger).scope("PromptManager");

  async createPrompt(options: PromptManager.CreatePromptOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      return tx
        .insert(schema.prompt)
        .values({
          name: options.name,
          roleDefinitionTemplate: options.roleDefinitionTemplate,
          instructionTemplate: options.instructionTemplate,
          mergeStrategy: options.mergeStrategy,
        })
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async updatePrompt(options: PromptManager.UpdatePromptOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx.$count(schema.prompt, eq(schema.prompt.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Prompt does not exist.");
      }

      return tx
        .update(schema.prompt)
        .set({
          name: options.name,
          roleDefinitionTemplate: options.roleDefinitionTemplate,
          instructionTemplate: options.instructionTemplate,
          mergeStrategy: options.mergeStrategy,
        })
        .where(eq(schema.prompt.id, options.id))
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async deletePrompt(options: PromptManager.DeletePromptOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx.$count(schema.prompt, eq(schema.prompt.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Prompt does not exist.");
      }

      return tx.delete(schema.prompt).where(eq(schema.prompt.id, options.id)).execute();
    });
  }

  async listPrompts() {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client
      .select()
      .from(schema.prompt)
      .orderBy(desc(schema.prompt.createTime))
      .execute()
      .then((result) => {
        return result.map((item) => {
          const variables: Record<"roleDefinition" | "instructionTemplate", string[]> = {
            roleDefinition: [],
            instructionTemplate: [],
          };

          return {
            ...item,
            ...{
              variables,
            },
          };
        });
      });
  }
}

export namespace PromptManager {
  export type CreatePromptOptions = Pick<
    PromptInsert,
    "name" | "roleDefinitionTemplate" | "instructionTemplate" | "mergeStrategy"
  >;

  export type UpdatePromptOptions = CreatePromptOptions & {
    id: string;
  };

  export type DeletePromptOptions = {
    id: string;
  };
}
