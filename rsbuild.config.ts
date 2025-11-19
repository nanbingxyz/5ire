import { resolve } from "node:path";
import { defineConfig, type EnvironmentConfig, type RsbuildConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginSass } from "@rsbuild/plugin-sass";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
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
      {
        from: "build",
        to: "build",
      },
      {
        from: "drizzle/migrations",
        to: "migrations",
      },
      {
        from: `node_modules/onnxruntime-node/bin/napi-v3/${process.platform}/${process.arch}`,
        to: `bin/onnxruntime/${process.platform}/${process.arch}`,
      },
    ];

    const externals: string[] = [
      "@lancedb/lancedb-darwin-x64",
      "@lancedb/lancedb-darwin-arm64",
      "@lancedb/lancedb-linux-x64-gnu",
      "@lancedb/lancedb-linux-arm64-gnu",
      "@lancedb/lancedb-linux-x64-musl",
      "@lancedb/lancedb-linux-arm64-musl",
      "@lancedb/lancedb-win32-x64-msvc",
      "@lancedb/lancedb-win32-arm64-msvc",

      "@napi-rs/canvas-linux-x64-gnu",
      "@napi-rs/canvas-darwin-x64",
      "@napi-rs/canvas-win32-x64-msvc",
      "@napi-rs/canvas-linux-arm-gnueabihf",
      "@napi-rs/canvas-linux-x64-musl",
      "@napi-rs/canvas-linux-arm64-gnu",
      "@napi-rs/canvas-linux-arm64-musl",
      "@napi-rs/canvas-darwin-arm64",
      "@napi-rs/canvas-android-arm64",
      "@napi-rs/canvas-linux-riscv64-gnu",

      "better-sqlite3",
      "@electric-sql/pglite",
      "sharp",
    ];

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
          optimization: {
            minimize: isCommandBuild,
          },
          plugins: [isCommandBuild && new RsdoctorRspackPlugin({})],
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
      sourceMap: isCommandDev,
      minify: isCommandBuild,
    },
    tools: {
      rspack: {
        ignoreWarnings: [
          (error) => {
            if (error.message?.includes("/node_modules/")) {
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
