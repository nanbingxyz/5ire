import type { ProviderKind } from "@/main/database/types";
import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { ProvidersManager } from "@/main/services/providers-manager";

export class ProvidersManagerBridge extends Bridge.define("providers-manager", () => {
  const service = Container.inject(ProvidersManager);

  const transformState = (state: ProvidersManager.State) => {
    return Array.from(state.providers.entries()).map(([_, { instance, data }]) => {
      return {
        ...data,
        ...{
          status: instance.status,
          capabilities: instance.capabilities,
          models: instance.models.map((model) => {
            return {
              name: model.name,
              description: model.description,
              capabilities: model.capabilities,
              title: model.title,
              maxContextLength: model.maxContextLength,
              maxOutput: model.maxOutput,
              pricing: model.pricing,
            };
          }),
        },
      };
    });
  };

  return {
    createProvider: service.createProvider.bind(service),
    deleteProvider: service.deleteProvider.bind(service),
    updateProvider: service.updateProvider.bind(service),

    createStateStream: () => {
      return service.createStream((state) => transformState(state));
    },

    async getProviderParameters(kind: ProviderKind) {
      return service.getProviderParameters(kind);
    },
  };
}) {}
