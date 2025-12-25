import { desc, eq } from "drizzle-orm";
import { default as memoize } from "memoizee";
import { Database } from "@/main/database";
import type { PromptInsert } from "@/main/database/types";
import { Container } from "@/main/internal/container";

export class PromptsManager {
  #database = Container.inject(Database);

  constructor() {
    this.livePrompts = memoize(this.livePrompts.bind(this), {
      primitive: true,
      promise: true,
    });
  }

  async createPrompt(options: PromptsManager.CreatePromptOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      return tx
        .insert(schema.prompt)
        .values({
          name: options.name,
          roleDefinitionTemplate: options.roleDefinitionTemplate,
          instructionTemplate: options.instructionTemplate,
        })
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async updatePrompt(options: PromptsManager.UpdatePromptOptions) {
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
        })
        .where(eq(schema.prompt.id, options.id))
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async deletePrompt(options: PromptsManager.DeletePromptOptions) {
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

  async livePrompts() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select(
        Database.utils.aliasedColumns({
          id: schema.prompt.id,
          createTime: schema.prompt.createTime,
          updateTime: schema.prompt.updateTime,
          name: schema.prompt.name,
          roleDefinitionTemplate: schema.prompt.roleDefinitionTemplate,
          instructionTemplate: schema.prompt.instructionTemplate,
        }),
      )
      .from(schema.prompt)
      .orderBy(schema.prompt.createTime);

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }
}

export namespace PromptsManager {
  export type CreatePromptOptions = Pick<PromptInsert, "name" | "roleDefinitionTemplate" | "instructionTemplate">;

  export type UpdatePromptOptions = CreatePromptOptions & {
    id: string;
  };

  export type DeletePromptOptions = {
    id: string;
  };
}
