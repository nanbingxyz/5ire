import { resolve } from "node:path";
import { defineConfig, type EnvironmentConfig, type RsbuildConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginSass } from "@rsbuild/plugin-sass";
import { config } from "dotenv";
import { ProductionDependenciesInstallerPlugin } from "./scripts/build/production-dependencies-installer";

const loadEnvironmentFile = () => {
  const result = config({
    path: resolve(__dirname, ".env"),
    override: false,
    quiet: false,
  });

  if (result.error) {
    throw result.error;
  }

  return result.parsed || {};
};

export default defineConfig(async ({ command }): Promise<RsbuildConfig> => {
  const isCommandDev = command === "dev";
  const isCommandBuild = command === "build";

  const port = 33077;
  const env = loadEnvironmentFile();
  const define = Object.entries(env).reduce(
    (define, [key, val]) => {
      define[`process.env.${key}`] = JSON.stringify(val);
      return define;
    },
    {} as Record<string, string>,
  );

  define["process.env.RENDERER_DEV_SERVER"] = isCommandDev ? `"http://localhost:${port}/renderer"` : "undefined";
  define["process.env.SOURCE_ROOT"] = isCommandDev ? `"${__dirname}"` : "undefined";

  const createMainEnvironment = () => {
    const copy: Array<Record<"from" | "to", string>> = [
      // {
      //   from: "build",
      //   to: "build",
      // },
      // {
      //   from: "drizzle/migrations",
      //   to: "migrations",
      // },
    ];

    const externals: string[] = ["@xenova/transformers", "@lancedb/lancedb", "better-sqlite3", "pdf-parse"];

    const config: EnvironmentConfig = {
      source: {
        entry: {
          main: "./src/main/main.ts",
        },
        define,
      },
      tools: {
        rspack: {
          target: "electron-main",
          output: {
            library: {
              type: "commonjs",
            },
            publicPath: "./",
          },
          optimization: {
            minimize: isCommandBuild,
            splitChunks: {},
          },
          plugins: [
            new ProductionDependenciesInstallerPlugin({
              externals,
              dev: isCommandDev,
              inspect: {
                port: port + 1,
              },
            }),
          ],
          externals,
        },
        htmlPlugin: false,
      },
      output: {
        target: "node",
        filename: {
          js: "[name].cjs",
        },
        copy,
      },
    };

    return config;
  };

  const createRendererEnvironment = () => {
    const config: EnvironmentConfig = {
      source: {
        entry: {
          index: "./src/renderer/index.tsx",
        },
        define,
      },
      output: {
        target: "web",
        distPath: {
          root: "output/renderer",
        },
      },
      tools: {
        rspack: {
          output: {
            publicPath: isCommandBuild ? "./" : undefined,
          },
        },
      },
      dev: {
        writeToDisk: true,
      },
      plugins: [pluginReact(), pluginSass()],
    };

    return config;
  };

  const createPreloadEnvironment = () => {
    const config: EnvironmentConfig = {
      source: {
        entry: {
          preload: "./src/main/preload.ts",
        },
        define,
      },
      tools: {
        rspack: {
          target: "electron-preload",
          output: {
            library: {
              type: "module",
            },
          },
        },
        htmlPlugin: false,
      },
      output: {
        target: "node",
        filename: {
          js: "[name].js",
        },
      },
      dev: {
        writeToDisk: true,
      },
    };

    return config;
  };

  return {
    environments: {
      main: createMainEnvironment(),
      renderer: createRendererEnvironment(),
      preload: createPreloadEnvironment(),
    },
    server: {
      port: port,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        utils: resolve(__dirname, "src/utils"),
      },
    },
    dev: {
      writeToDisk: true,
    },
    output: {
      distPath: {
        root: "output",
      },
      cleanDistPath: true,
    },
    tools: {
      rspack: {
        ignoreWarnings: [
          (error) => {
            if (error.file?.includes("/node_modules/")) {
              return true;
            }

            if (error.message?.includes("Critical dependency")) {
              return true;
            }

            return false;
          },
        ],
      },
    },
  };
});
