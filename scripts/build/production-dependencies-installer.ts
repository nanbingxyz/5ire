import { execSync as execute } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { Rspack } from "@rsbuild/core";
import { default as chalk } from "chalk";
import { existsSync } from "fs-extra";

const log = {
  info: (message: string) => {
    console.log(chalk.green("  -"), chalk.gray(message));
  },
  warning: (message: string) => {
    console.log(chalk.yellow("  -"), chalk.yellow(message));
  },
};

/**
 * A Rspack plugin that automates handling Node.js dependencies for Electron projects.
 *
 * After the build is done, it:
 * - Creates a new package.json in the output directory with selected fields from the original
 * - Installs specified external dependencies into the output directory using npm
 * - Runs electron-builder install-app-deps to handle native dependencies
 * - In development mode, generates nodemon.json for Electron debugging
 */
export class ProductionDependenciesInstallerPlugin implements Rspack.RspackPluginInstance {
  constructor(private options: ProductionDependenciesInstallerPlugin.Options) {}

  apply(compiler: Rspack.Compiler) {
    let first = true;

    compiler.hooks.done.tapAsync("ProductionDependenciesInstallerPlugin", async (_, fn) => {
      if (first) {
        first = false;
      } else {
        log.info("Skipping production dependencies installer plugin.");
        return fn();
      }

      const { output, context } = compiler.options;

      if (!context) {
        return fn(new Error("Unable to determine project root directory (context)."));
      }

      const require = createRequire(__dirname);

      let electron = "";
      let electronVersion = "";

      try {
        electron = require("electron");
        electronVersion = require("electron/package.json").version;
      } catch {}

      if (!electron) {
        return fn(new Error("Unable to determine Electron executable path."));
      }

      const dist = output.path || join(process.cwd(), "output");
      const packageJsonPath = join(context, "package.json");

      let packageJson: any;

      try {
        packageJson = require(packageJsonPath);
      } catch {
        return fn(new Error(`Failed to read the main package.json at ${packageJsonPath}.`));
      }

      try {
        await writeFile(
          join(dist, "package.json"),
          JSON.stringify(
            {
              name: packageJson.name,
              description: packageJson.description,
              version: packageJson.version,
              type: packageJson.type,
              main: "./main.cjs",
              build: this.options.dev
                ? {
                    electronVersion,
                  }
                : undefined,
            },
            null,
            2,
          ),
        );
      } catch (err) {
        return fn(new Error(`Failed to prepare output directory with package.json or lockfile: ${err}`));
      }

      const externals = this.options.externals || [];
      const packages = externals
        .map((external) => {
          const packageJsonFile = resolve(process.cwd(), "node_modules", external, "package.json");

          if (!existsSync(packageJsonFile)) {
            log.warning(`Cannot find package.json for external dependency "${external}". Skipping.`);
          } else {
            try {
              return `${external}@${require(packageJsonFile).version}`;
            } catch {
              log.warning(`Failed to read package.json for external dependency "${external}".`);
            }
          }

          return "";
        })
        .filter(Boolean);

      if (packages.length) {
        log.info(`Installing ${packages.length} external dependencies in output...`);

        try {
          execute(`npm install ${packages.join(" ")} --only=production`, {
            cwd: dist,
            stdio: "ignore",
          });

          if (this.options.dev) {
            execute("npx electron-builder install-app-deps", {
              cwd: dist,
              stdio: "ignore",
            });
          }
        } catch (err) {
          return fn(new Error(`Failed to install external dependencies in output: ${err}`));
        }
      }

      if (this.options.dev) {
        try {
          const command = [electron];

          if (this.options.inspect) {
            command.push(`--inspect=${this.options.inspect.port}`);
          }

          command.push(".");

          await writeFile(
            join(dist, "nodemon.json"),
            JSON.stringify(
              {
                verbose: false,
                ignore: ["node_modules", "migrations", "build", "static"],
                watch: ["./"],
                ext: "cjs",
                delay: 1000,
                exec: command.join(" "),
              },
              null,
              2,
            ),
          );
        } catch (err) {
          return fn(new Error(`Failed to write nodemon.json in dist: ${err}`));
        }
      }

      return fn();
    });
  }
}

export namespace ProductionDependenciesInstallerPlugin {
  /**
   * Plugin configuration options type
   */
  export type Options = {
    /**
     * List of external dependencies to install in output.
     * These dependencies will be installed with their versions from the main node_modules.
     */
    externals?: string[];

    /**
     * Whether to enable development mode.
     * If true, it will generate nodemon.json for Electron debugging.
     */
    dev?: boolean;

    /**
     * Electron debugging configuration, allowing specification of the debug port.
     */
    inspect?: {
      /**
       * Debug port number, used to start Electron in Node.js debug mode.
       */
      port: number;
    };
  };
}
