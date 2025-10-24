import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";

export class Renderer {
  private readonly environment = Container.inject(Environment);
}
