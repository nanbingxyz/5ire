import { execSync as execute } from "node:child_process";
import { lstat, readFile, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { Rspack } from "@rsbuild/core";

/**
 * A Rspack plugin that automates handling Node.js dependencies for Electron projects.
 *
 * After the build is done, it copies package.json and lockfile to the output directory and can:
 * - Create a node_modules symlink in development mode
 * - Generate nodemon.json for Electron debugging
 * - Install specified external dependencies into the output directory
 */
export class ProductionDependenciesInstallerPlugin implements Rspack.RspackPluginInstance {
  constructor(private options: ProductionDependenciesInstallerPlugin.Options) {}

  apply(compiler: Rspack.Compiler) {
    compiler.hooks.done.tapAsync("ProductionDependenciesInstallerPlugin", async (_, fn) => {
      const { output, context } = compiler.options;

      if (!context) {
        return fn(new Error("Unable to determine project root directory (context)."));
      }

      const require = createRequire(__dirname);

      let electron = "";

      try {
        electron = require("electron");
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

      const packagesLockFile = join(context, "package-lock.json");

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
            },
            null,
            2,
          ),
        );

        await writeFile(join(dist, "package-lock.json"), await readFile(packagesLockFile));
      } catch (err) {
        return fn(new Error(`Failed to prepare output directory with package.json or lockfile: ${err}`));
      }

      if (this.options.dev) {
        try {
          const target = join(context, "node_modules");
          const link = join(dist, "node_modules");

          let exists = false;

          try {
            const stat = await lstat(link);
            exists = stat.isSymbolicLink() || stat.isDirectory();
          } catch {}

          if (!exists) {
            await symlink(target, link, "junction");
          }
        } catch (err) {
          return fn(new Error(`Failed to create node_modules symlink in dist: ${err}`));
        }

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
                ignore: ["*/"],
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

        return fn();
      }

      const external = this.options.externals || [];
      const dependencies = packageJson.dependencies as Record<string, string>;

      for (let index = 0; index < external.length; index++) {
        const item = external[index];
        const version = dependencies[item];

        if (!version) {
          return fn(
            new Error(
              `Cannot determine version for external dependency "${item}". Ensure it is listed in dependencies.`,
            ),
          );
        }

        external[index] = `${item}@${version}`;
      }

      try {
        if (external.length) {
          execute(`npm install ${external.join(" ")}`, {
            cwd: dist,
            encoding: "utf-8",
            stdio: "inherit",
          });

          execute(`npx electron-builder install-app-deps`, {
            cwd: dist,
            encoding: "utf-8",
            stdio: "inherit",
          });
        }

        return fn();
      } catch (err) {
        return fn(new Error(`Failed to install external dependencies in output: ${err}`));
      }
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
     * Each dependency must be declared in package.json dependencies.
     */
    externals?: string[];

    /**
     * Whether to enable development mode.
     * If true, it will create a node_modules symlink and generate nodemon.json.
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
