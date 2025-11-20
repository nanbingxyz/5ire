import { pathExists, readFile } from "fs-extra";
import { z } from "zod";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

const LegacyServersConfigSchema = z.object({
  mcpServers: z.record(z.unknown()),
});

const LegacyServerConfigSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    command: z.string().optional(),
    url: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    isActive: z.boolean().optional(),
    headers: z.record(z.string()).optional(),
    approvalPolicy: z.union([z.literal("never"), z.literal("always"), z.literal("once")]).optional(),
  })
  .refine((config) => {
    return Boolean(config.command) !== Boolean(config.url);
  });

export class LegacyServersConfigLoader {
  #environment = Container.inject(Environment);
  #logger = Container.inject(Logger).scope("LegacyServersConfigLoader");

  async load() {
    try {
      const exists = await pathExists(this.#environment.legacyMCPConfigPath);

      if (!exists) {
        return this.#logger.debug("Legacy servers config file does not exist");
      }

      return readFile(this.#environment.legacyMCPConfigPath, "utf-8")
        .then(JSON.parse)
        .then(LegacyServersConfigSchema.parse)
        .then((config) => {
          const servers: Array<{ key: string } & z.infer<typeof LegacyServerConfigSchema>> = [];

          for (const [key, value] of Object.entries(config.mcpServers)) {
            try {
              servers.push({
                key,
                ...LegacyServerConfigSchema.parse(value),
              });
            } catch (error) {
              this.#logger.capture(error, { reason: `Failed to parse legacy server config: "${key}"` });
            }
          }

          return servers;
        });
    } catch (error) {
      return this.#logger.capture(error, { reason: "Failed to load legacy servers config" });
    }
  }
}
