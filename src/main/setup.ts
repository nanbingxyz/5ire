import "pdf-parse/worker";

import { join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { app } from "electron";
import { default as fixPath } from "fix-path";
import { PDFParse } from "pdf-parse";
import { getData } from "pdf-parse/worker";

// Fix the $PATH on macOS and Linux when running inside Electron.
// This ensures that executables installed via package managers like Homebrew
// are available in the PATH for child processes spawned by the application.
fixPath();

// TODO: Remove this
loadEnv({
  path: app.isPackaged ? join(process.resourcesPath, ".env") : resolve(process.cwd(), ".env"),
  override: true,
});

if (!app.isPackaged) {
  require("source-map-support").install();
}

PDFParse.setWorker(getData());
