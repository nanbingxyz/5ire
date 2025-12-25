import { eq } from "drizzle-orm";
import { default as memoize } from "memoizee";
import { Database } from "@/main/database";
import type { ProjectConfig } from "@/main/database/types";
import { Container } from "@/main/internal/container";

export class ProjectsManager {
  #database = Container.inject(Database);

  constructor() {
    this.liveProjects = memoize(this.liveProjects.bind(this), {
      primitive: true,
      promise: true,
    });
  }

  async createProject(options: ProjectsManager.CreateProjectOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      return tx
        .insert(schema.project)
        .values({
          name: options.name,
          config: options.config,
        })
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async updateProject(options: ProjectsManager.UpdateProjectOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx.$count(schema.project, eq(schema.project.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Project does not exist.");
      }

      return tx
        .update(schema.project)
        .set({
          name: options.name,
          config: options.config,
        })
        .where(eq(schema.project.id, options.id))
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async deleteProject(options: ProjectsManager.DeleteProjectOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx.$count(schema.project, eq(schema.project.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Project does not exist.");
      }

      return tx.delete(schema.project).where(eq(schema.project.id, options.id)).execute();
    });
  }

  async liveProjects() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select(
        Database.utils.aliasedColumns({
          id: schema.project.id,
          createTime: schema.project.createTime,
          updateTime: schema.project.updateTime,
          name: schema.project.name,
          config: schema.project.config,
          legacyFolderId: schema.project.legacyFolderId,
        }),
      )
      .from(schema.project)
      .orderBy(schema.project.createTime);

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

export namespace ProjectsManager {
  export type CreateProjectOptions = {
    name: string;
    config: ProjectConfig;
  };

  export type UpdateProjectOptions = CreateProjectOptions & {
    id: string;
  };

  export type DeleteProjectOptions = {
    id: string;
  };
}
