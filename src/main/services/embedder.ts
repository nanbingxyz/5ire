import { join } from "node:path";
import type { FeatureExtractionPipeline } from "@xenova/transformers/types/pipelines";
import { existsSync, move, rm } from "fs-extra";
import { DOCUMENT_EMBEDDING_MODEL_FILES, DOCUMENT_EMBEDDING_MODEL_NAME } from "@/main/constants";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Downloader } from "@/main/services/downloader";

export class Embedder {
  #environment = Container.inject(Environment);
  #downloader = Container.inject(Downloader);
  #inProgress = false;
  #modelFiles = DOCUMENT_EMBEDDING_MODEL_FILES.map((item) => {
    return {
      ...item,
      ...{
        path: join(this.#environment.embedderModelsFolder, DOCUMENT_EMBEDDING_MODEL_NAME, item.path || item.name),
      },
    };
  });

  #extractor?: FeatureExtractionPipeline;

  async #initExtractor() {
    const { env, pipeline } = await import("@xenova/transformers");

    env.allowRemoteModels = false;
    env.allowLocalModels = true;

    Object.defineProperty(env, "localModelPath", {
      value: this.#environment.embedderModelsFolder,
    });

    this.#extractor = await pipeline("feature-extraction", DOCUMENT_EMBEDDING_MODEL_NAME);
  }

  get available() {
    return !!this.#extractor;
  }

  async init() {
    if (this.#extractor) {
      return;
    }

    for (const file of this.#modelFiles) {
      if (!existsSync(file.path)) {
        return;
      }
    }

    return this.#initExtractor();
  }

  async removeModel() {
    if (this.#inProgress) {
      throw new Error("Model is in progress");
    }

    this.#extractor?.dispose().catch(() => {
      // ignore
    });

    this.#extractor = undefined;

    await rm(this.#environment.embedderModelsFolder, {
      recursive: true,
    });
  }

  async downloadModel(signal: AbortSignal, onProgress?: (name: string, total: number, received: number) => void) {
    for (const file of this.#modelFiles) {
      if (existsSync(file.path)) {
        throw new Error(`Model file ${file.name} already exists. Please remove model after download.`);
      }
    }

    const progress: Record<string, Record<"total" | "received", number>> = {};

    for (const { name } of DOCUMENT_EMBEDDING_MODEL_FILES) {
      progress[name] = {
        total: 0,
        received: 0,
      };
    }

    const abort = new AbortController();

    await Promise.all(
      this.#modelFiles.map(async (file) => {
        return this.#downloader
          .download({
            signal: AbortSignal.any([signal, abort.signal]),
            url: file.url,
            onProgress: (received, total) => {
              onProgress?.(file.name, total, received);
            },
          })
          .then((it) => {
            return move(it.dist, file.path);
          })
          .catch((e) => {
            throw new Error(`Failed to download model file ${file.name}: ${e.message}`);
          });
      }),
    ).then(() => {
      return this.#initExtractor();
    });
  }

  async embed(text: string) {
    if (!this.#extractor) {
      throw new Error("Model is not available");
    }

    return this.#extractor(text, { pooling: "mean", normalize: true }).then((tensor) => {
      if (tensor.data instanceof Float32Array) {
        return [...tensor.data];
      }

      throw new Error("Invalid tensor data");
    });
  }
}
