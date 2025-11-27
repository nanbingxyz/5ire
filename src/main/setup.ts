import { join, resolve } from "node:path";
import { app } from "electron";

// Fix the $PATH on macOS and Linux when running inside Electron.
// This ensures that executables installed via package managers like Homebrew
// are available in the PATH for child processes spawned by the application.
require("fix-path")();

require("dotenv").config({
  path: app.isPackaged ? join(process.resourcesPath, ".env") : resolve(process.cwd(), ".env"),
});

if (process.env.NODE_ENV !== "production") {
  require("source-map-support").install();
}
