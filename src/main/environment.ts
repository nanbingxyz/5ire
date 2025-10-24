import { Container } from "@/main/internal/container";

export type Environment = {
  cryptoSecret: string;

  rendererDevServer?: string;
  rendererEntry: string;

  preloadEntry: string;

  assetsFolder: string;
};

export namespace Environment {}

export const Environment = Container.createToken<Environment>("Environment");
