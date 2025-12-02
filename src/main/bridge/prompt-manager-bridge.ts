import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { PromptManager } from "@/main/services/prompt-manager";

export class PromptManagerBridge extends Bridge.define("prompt-manager", () => {
  const service = Container.inject(PromptManager);

  return {
    createPrompt: service.createPrompt.bind(service),
    deletePrompt: service.deletePrompt.bind(service),
    listPrompts: service.listPrompts.bind(service),
    updatePrompt: service.updatePrompt.bind(service),
  };
}) {}
