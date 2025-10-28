import { Container } from "@/main/internal/container";

export type Environment = {
  /**
   * The secret used to encrypt sensitive data.
   */
  readonly cryptoSecret: string;
  /**
   * The URL of the renderer process's development server.
   */
  readonly rendererDevServer?: string;
  /**
   * The entry point of the renderer process.
   */
  readonly rendererEntry: string;
  /**
   * The entry point of the preload script.
   */
  readonly preloadEntry: string;
  /**
   * The folder where assets are stored.
   */
  readonly assetsFolder: string;
  /**
   * The folder where embedding models are stored.
   */
  readonly embedderModelsFolder: string;
  /**
   * The folder where embedding cache is stored.
   */
  readonly embedderCacheFolder: string;

  readonly storiesFolder: string;
};

export namespace Environment {}

export const Environment = Container.createToken<Environment>("Environment");
