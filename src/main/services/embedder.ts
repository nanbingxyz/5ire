import { join } from "node:path";
import type { FeatureExtractionPipeline } from "@xenova/transformers/types/pipelines";
import { asError } from "catch-unknown";
import { ensureDir, move, rm, stat } from "fs-extra";
import { DOCUMENT_EMBEDDING_MODEL_FILES, DOCUMENT_EMBEDDING_MODEL_NAME } from "@/main/constants";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Emitter } from "@/main/internal/emitter";
import { Store } from "@/main/internal/store";
import { Downloader } from "@/main/services/downloader";
import { Logger } from "@/main/services/logger";

export class Embedder extends Store<Embedder.State> {
  #environment = Container.inject(Environment);
  #downloader = Container.inject(Downloader);
  #logger = Container.inject(Logger).scope("Embedder");
  #emitter = Emitter.create<Embedder.Events>();

  get emitter() {
    return this.#emitter;
  }

  constructor() {
    super(() => {
      return {
        status: {
          type: "idle",
        },
        model: DOCUMENT_EMBEDDING_MODEL_NAME,
        files: DOCUMENT_EMBEDDING_MODEL_FILES.map((file) => file.name),
      };
    });
  }

  async init() {
    const logger = this.#logger.scope("Init");

    if (this.state.status.type !== "idle") {
      return logger.error("Cannot initialize embedder: embedder is already initialized");
    }

    this.update((draft) => {
      draft.status = {
        type: "initializing",
      };
    });

    let missing = false;
    let partially = false;

    for (const file of DOCUMENT_EMBEDDING_MODEL_FILES) {
      const folder = join(this.#environment.embedderModelsFolder, DOCUMENT_EMBEDDING_MODEL_NAME);
      const path = join(folder, file.path || file.name);

      const exists = await stat(path)
        .then((s) => s.isFile())
        .catch(() => false);

      if (exists) {
        partially = true;
      } else {
        missing = true;
      }
    }

    if (missing) {
      logger.warning("Model files are missing, cannot initialize embedder");

      return this.update((draft) => {
        draft.status = {
          type: "unavailable",
          reason: partially ? "model-partially-missing" : "model-missing",
        };
      });
    }

    await import("@xenova/transformers")
      .then(({ env, pipeline }) => {
        env.allowRemoteModels = false;
        env.allowLocalModels = true;

        Object.defineProperty(env, "localModelPath", {
          value: this.#environment.embedderModelsFolder,
        });

        return pipeline("feature-extraction", DOCUMENT_EMBEDDING_MODEL_NAME);
      })
      .then((extractor) => {
        this.update((draft) => {
          draft.status = { type: "ready", extractor, running: 0 };
        });
      })
      .catch((error) => {
        logger.capture(error, "Failed to initialize feature extraction pipeline");
        this.update((draft) => {
          draft.status = { type: "unavailable", reason: "pipeline-init-failed" };
        });
      });
  }

  async removeModel() {
    const logger = this.#logger.scope("RemoveModel");

    if (this.state.status.type !== "unavailable" && this.state.status.type !== "ready") {
      return logger.error("Cannot remove model: embedder is not in unavailable or ready state");
    }

    if (this.state.status.type === "ready") {
      await this.state.status.extractor.dispose().catch((error) => {
        logger.capture(error, "Failed to dispose feature extraction pipeline");
      });
    }

    await rm(this.#environment.embedderModelsFolder, { recursive: true }).catch((error) => {
      logger.capture(error, "Failed to remove embedder model folder");
    });

    this.update((draft) => {
      draft.status = { type: "unavailable", reason: "model-missing" };
    });
  }

  async downloadModel() {
    const logger = this.#logger.scope("DownloadModel");

    if (this.state.status.type !== "unavailable") {
      return logger.error("Cannot download model: embedder is not in unavailable state");
    }

    await rm(this.#environment.embedderModelsFolder, { recursive: true, force: true }).catch((error) => {
      logger.capture(error, "Failed to remove embedder model folder");
    });
    await ensureDir(this.#environment.embedderModelsFolder).catch((error) => {
      logger.capture(error, "Failed to create embedder model folder");
    });

    const progress: Record<string, Record<"total" | "received", number>> = {};
    const controller = new AbortController();

    for (const { name } of DOCUMENT_EMBEDDING_MODEL_FILES) {
      progress[name] = {
        total: 0,
        received: 0,
      };
    }

    this.update((draft) => {
      draft.status = {
        type: "downloading",
        progress,
        controller,
      };
    });

    Promise.all(
      DOCUMENT_EMBEDDING_MODEL_FILES.map(async (file) => {
        return this.#downloader
          .download({
            signal: controller.signal,
            url: file.url,
            onProgress: (received, total) => {
              this.update((draft) => {
                if (draft.status.type === "downloading") {
                  draft.status.progress[file.name].total = total;
                  draft.status.progress[file.name].received = received;
                }
              });
            },
          })
          .then((downloaded) => {
            return {
              file,
              downloaded,
            };
          })
          .catch((e) => {
            throw new Error(`Failed to download model file ${file.name}: ${e.message}`);
          });
      }),
    )
      .then(async (downloaded) => {
        const folder = join(this.#environment.embedderModelsFolder, DOCUMENT_EMBEDDING_MODEL_NAME);

        return Promise.all(
          downloaded.map((item) => {
            return move(item.downloaded.dist, join(folder, item.file.path || item.file.name));
          }),
        );
      })
      .then(() => {
        this.update((draft) => {
          draft.status = {
            type: "idle",
          };
        });
        this.init().catch(() => {});
      })
      .catch((error) => {
        this.update((draft) => {
          draft.status = {
            type: "unavailable",
            reason: "model-missing",
          };
        });

        if (controller.signal.aborted) {
          return;
        }

        logger.capture(error, "Failed to download model");

        this.emitter.emit("model-download-failed", {
          message: asError(error).message,
        });
      });
  }

  async cancelDownloadModel() {
    const logger = this.#logger.scope("CancelDownloadModel");

    if (this.state.status.type !== "downloading") {
      return logger.error("Cannot cancel download model: embedder is not in downloading state");
    }

    this.state.status.controller.abort();
  }

  async embed(text: string) {
    const logger = this.#logger.scope("Embed");

    if (this.state.status.type !== "ready") {
      logger.error("Cannot embed text: embedder is not ready");
      throw new Error("Embedder is not ready");
    }

    this.update((draft) => {
      if (draft.status.type === "ready") {
        draft.status.running++;
      }
    });

    return this.state.status
      .extractor(text, { pooling: "mean", normalize: true })
      .then((tersor) => {
        return tersor.tolist() as number[];
      })
      .catch((error) => {
        logger.capture(error, "Failed to embed text");
        throw error;
      })
      .finally(() => {
        this.update((draft) => {
          if (draft.status.type === "ready") {
            draft.status.running--;
          }
        });
      });
  }
}

export namespace Embedder {
  export type Status =
    | {
        type: "idle";
      }
    | {
        type: "initializing";
      }
    | {
        type: "ready";
        extractor: FeatureExtractionPipeline;
        running: number;
      }
    | {
        type: "unavailable";
        reason: "model-missing" | "model-partially-missing" | "pipeline-init-failed";
      }
    | {
        type: "downloading";
        progress: Record<string, Record<"total" | "received", number>>;
        controller: AbortController;
      };

  export type State = {
    /**
     * The status of the embedder service.
     */
    status: Status;
    /**
     * The name of the embedder model.
     */
    model: string;
    /**
     * The files required to initialize the embedder model.
     */
    files: string[];
  };

  export type Events = {
    /**
     * Emitted when the model download fails.
     */
    "model-download-failed": {
      /**
       * The error message.
       */
      message: string;
    };
  };
}
