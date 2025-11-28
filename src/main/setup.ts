import { join, resolve } from "node:path";
import { DOMMatrix } from "@napi-rs/canvas";
import { config as loadEnv } from "dotenv";
import { app } from "electron";
import { default as fixPath } from "fix-path";

// Fix the $PATH on macOS and Linux when running inside Electron.
// This ensures that executables installed via package managers like Homebrew
// are available in the PATH for child processes spawned by the application.
fixPath();

// TODO: Remove this
loadEnv({
  path: app.isPackaged ? join(process.resourcesPath, ".env") : resolve(process.cwd(), ".env"),
  override: true,
});

require("source-map-support").install();

// GitHub workflow build artifacts fail to find DOMMatrix at runtime.
// Define DOMMatrix on the global object to resolve this issue.
if (!("DOMMatrix" in globalThis)) {
  Object.defineProperty(globalThis, "DOMMatrix", {
    value: DOMMatrix,
  });
}
