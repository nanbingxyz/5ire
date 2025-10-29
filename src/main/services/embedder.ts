import { join } from "node:path";
import type { FeatureExtractionPipeline } from "@xenova/transformers/types/pipelines";
import { move, rm, stat } from "fs-extra";
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
        status: "idle",
      };
    });
  }

  async init() {
    if (this.state.status !== "idle") {
      return;
    }

    this.replace({ status: "initializing" });

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
      return this.replace({ status: "unavailable", reason: partially ? "model-partially-missing" : "model-missing" });
    }

    const { env, pipeline } = await import("@xenova/transformers");

    env.allowRemoteModels = false;
    env.allowLocalModels = true;

    Object.defineProperty(env, "localModelPath", {
      value: this.#environment.embedderModelsFolder,
    });

    await pipeline("feature-extraction", DOCUMENT_EMBEDDING_MODEL_NAME)
      .then((extractor) => {
        this.replace({ status: "ready", extractor, running: 0 });
      })
      .catch(() => {
        this.replace({ status: "unavailable", reason: "pipeline-init-failed" });
      });
  }

  async remove() {
    if (this.state.status !== "unavailable" && this.state.status !== "ready") {
      throw new Error("Embedder is not unavailable or ready");
    }

    if (this.state.status === "ready") {
      await this.state.extractor.dispose();
    }

    await rm(this.#environment.embedderModelsFolder, { recursive: true });

    this.replace({
      status: "unavailable",
      reason: "model-missing",
    });
  }

  async download(signal: AbortSignal, onProgress?: (name: string, received: number, total: number) => void) {
    if (this.state.status !== "unavailable") {
      throw new Error("Embedder is not unavailable");
    }

    await rm(this.#environment.embedderModelsFolder, { recursive: true });

    const progress: Record<string, Record<"total" | "received", number>> = {};

    for (const { name } of DOCUMENT_EMBEDDING_MODEL_FILES) {
      progress[name] = {
        total: 0,
        received: 0,
      };
    }

    this.replace({
      status: "downloading",
      progress,
    });

    await Promise.all(
      DOCUMENT_EMBEDDING_MODEL_FILES.map(async (file) => {
        return this.#downloader
          .download({
            signal,
            url: file.url,
            onProgress: (received, total) => {
              this.update((draft) => {
                if (draft.status === "downloading") {
                  draft.progress[file.name].total = total;
                  draft.progress[file.name].received = received;
                }
              });
              onProgress?.(file.name, received, total);
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
        this.replace({ status: "idle" });
        this.init().catch(() => {});
      })
      .catch((e) => {
        this.replace({ status: "unavailable", reason: "model-missing" });

        throw e;
      });
  }

  async embed(text: string) {
    if (this.state.status !== "ready") {
      throw new Error("Embedder is not ready");
    }

    this.update((draft) => {
      if (draft.status === "ready") {
        draft.running++;
      }
    });

    return this.state
      .extractor(text, { pooling: "mean", normalize: true })
      .then((tersor) => {
        return tersor.tolist() as number[];
      })
      .finally(() => {
        this.update((draft) => {
          if (draft.status === "ready") {
            draft.running--;
          }
        });
      });
  }
}

export namespace Embedder {
  export type State =
    | {
        status: "idle";
      }
    | {
        status: "initializing";
      }
    | {
        status: "ready";
        extractor: FeatureExtractionPipeline;
        running: number;
      }
    | {
        status: "unavailable";
        reason: "model-missing" | "model-partially-missing" | "pipeline-init-failed";
      }
    | {
        status: "downloading";
        progress: Record<string, Record<"total" | "received", number>>;
      };
}
