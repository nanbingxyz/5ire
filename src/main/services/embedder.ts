import { join } from "node:path";
import type { FeatureExtractionPipeline } from "@xenova/transformers/types/pipelines";
import { ensureDir, move, rm, stat } from "fs-extra";
import { DOCUMENT_EMBEDDING_MODEL_FILES, DOCUMENT_EMBEDDING_MODEL_NAME } from "@/main/constants";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Store } from "@/main/internal/store";
import { Downloader } from "@/main/services/downloader";

export class Embedder extends Store<Embedder.State> {
  #environment = Container.inject(Environment);
  #downloader = Container.inject(Downloader);

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
    if (this.state.status.type !== "idle") {
      return;
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
      return this.update((draft) => {
        draft.status = {
          type: "unavailable",
          reason: partially ? "model-partially-missing" : "model-missing",
        };
      });
    }

    const { env, pipeline } = await import("@xenova/transformers");

    env.allowRemoteModels = false;
    env.allowLocalModels = true;

    Object.defineProperty(env, "localModelPath", {
      value: this.#environment.embedderModelsFolder,
    });

    await pipeline("feature-extraction", DOCUMENT_EMBEDDING_MODEL_NAME)
      .then((extractor) => {
        this.update((draft) => {
          draft.status = { type: "ready", extractor, running: 0 };
        });
      })
      .catch(() => {
        this.update((draft) => {
          draft.status = { type: "unavailable", reason: "pipeline-init-failed" };
        });
      });
  }

  async removeModel() {
    if (this.state.status.type !== "unavailable" && this.state.status.type !== "ready") {
      throw new Error("Embedder is not unavailable or ready");
    }

    if (this.state.status.type === "ready") {
      await this.state.status.extractor.dispose().catch(() => {});
    }

    await rm(this.#environment.embedderModelsFolder, { recursive: true }).catch(() => {});

    this.update((draft) => {
      draft.status = { type: "unavailable", reason: "model-missing" };
    });
  }

  async downloadModel() {
    if (this.state.status.type !== "unavailable") {
      throw new Error("Embedder is not unavailable");
    }

    await rm(this.#environment.embedderModelsFolder, { recursive: true, force: true });
    await ensureDir(this.#environment.embedderModelsFolder);

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
      .catch((e) => {
        this.update((draft) => {
          draft.status = {
            type: "unavailable",
            reason: "model-missing",
          };
        });

        if (controller.signal.aborted) {
          return;
        }
      });
  }

  async cancelDownloadModel() {
    if (this.state.status.type !== "downloading") {
      throw new Error("Embedder is not downloading");
    }

    this.state.status.controller.abort();
  }

  async embed(text: string) {
    if (this.state.status.type !== "ready") {
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
    status: Status;
    model: string;
    files: string[];
  };
}
