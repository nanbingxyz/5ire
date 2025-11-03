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

/**
 * Embedder class handles generation of text embedding vectors
 * Responsible for model downloading, initialization, removal, and text embedding functions
 * @extends Store<Embedder.State>
 */
export class Embedder extends Store<Embedder.State> {
  #environment = Container.inject(Environment);
  #downloader = Container.inject(Downloader);
  #logger = Container.inject(Logger).scope("Embedder");
  #emitter = Emitter.create<Embedder.Events>();

  /**
   * Get event emitter instance
   * @returns Event emitter instance
   */
  get emitter() {
    return this.#emitter;
  }

  /**
   * Create Embedder instance
   * Initialize state, model name, and required file list
   */
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

  /**
   * Initialize embedding model
   * Check if model files exist, and load the model if they do
   * @returns Promise<void>
   */
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

  /**
   * Remove downloaded model
   * If the model is in ready state, release resources first then delete the folder
   * @returns Promise<void>
   */
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

  /**
   * Download embedding model files
   * Delete old model files and re-download all required model files
   * @returns Promise<void>
   */
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

  /**
   * Cancel model download
   * Cancel ongoing downloads by calling the abort method of AbortController
   * @returns Promise<void>
   */
  async cancelDownloadModel() {
    const logger = this.#logger.scope("CancelDownloadModel");

    if (this.state.status.type !== "downloading") {
      return logger.error("Cannot cancel download model: embedder is not in downloading state");
    }

    this.state.status.controller.abort();
  }

  /**
   * Process text embedding
   * Convert text to vector representation using the loaded model
   * @param text Array of text to be embedded
   * @returns Promise<number[][]> Embedding vector array
   */
  async embed(text: string[]) {
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
      .then((tensor) => {
        return tensor.tolist() as number[][];
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
  /**
   * Embedder service status types
   * Represents the status of the embedder service at different stages
   */
  export type Status =
    | {
        /**
         * Idle state
         * Embedder service has not been initialized or has completed operations
         */
        type: "idle";
      }
    | {
        /**
         * Initializing state
         * Embedder service is undergoing initialization process
         */
        type: "initializing";
      }
    | {
        /**
         * Ready state
         * Embedder service has been successfully initialized and is ready to handle embedding requests
         */
        type: "ready";
        /**
         * Feature extraction pipeline instance
         * Used to perform actual text embedding operations
         */
        extractor: FeatureExtractionPipeline;
        /**
         * Number of running tasks
         * Records the current number of embedding requests being processed
         */
        running: number;
      }
    | {
        /**
         * Unavailable state
         * Embedder service is unavailable for some reason
         */
        type: "unavailable";
        /**
         * Reason for unavailability
         * - model-missing: Model files missing
         * - model-partially-missing: Model files partially missing
         * - pipeline-init-failed: Pipeline initialization failed
         */
        reason: "model-missing" | "model-partially-missing" | "pipeline-init-failed";
      }
    | {
        /**
         * Downloading state
         * Embedder service is downloading model files
         */
        type: "downloading";
        /**
         * Download progress record
         * Keyed by filename, records total size and received size for each file
         */
        progress: Record<string, Record<"total" | "received", number>>;
        /**
         * Download controller
         * Used to cancel ongoing download operations
         */
        controller: AbortController;
      };

  /**
   * Complete state definition of the embedder
   * Includes service status, model name, and required file list
   */
  export type State = {
    /**
     * Status of the embedder service
     * Represents the current operational stage of the service
     */
    status: Status;
    /**
     * Name of the embedder model
     * Used to identify the currently used embedding model
     */
    model: string;
    /**
     * Required file list for initializing the embedder model
     * Lists all model filenames that must exist
     */
    files: string[];
  };

  /**
   * Event definitions for the embedder service
   * Defines various events that the service may trigger
   */
  export type Events = {
    /**
     * Event triggered when model download fails
     * Emitted when an error occurs during model file download
     */
    "model-download-failed": {
      /**
       * Error message
       * Contains specific description of download failure reason
       */
      message: string;
    };
  };
}
