import { find, isNil, keyBy, omit, pickBy, unionBy } from 'lodash';
import { getBuiltInProvider, getBuiltInProviders } from 'providers';
import {
  IChatModel,
  IChatModelConfig,
  IChatProviderConfig,
  ProviderType,
} from 'providers/types';
import { genDefaultName } from 'utils/util';
import { create } from 'zustand';
import OpenAI from 'providers/OpenAI';
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  ERROR_MODEL,
  MAX_TOKENS,
} from 'consts';
import { isBlank } from 'utils/validators';
import { typeid } from 'typeid-js';
import useAuthStore from './useAuthStore';

const ErrorModel = {
  id: ERROR_MODEL,
  name: ERROR_MODEL,
  label: 'Invalid Model',
  isReady: false,
  isDefault: false,
  contextWindow: DEFAULT_CONTEXT_WINDOW,
  capabilities: {},
  maxTokens: MAX_TOKENS,
  defaultMaxTokens: DEFAULT_MAX_TOKENS,
  inputPrice: 0,
  outputPrice: 0,
  description: 'Error fetching models',
  isBuiltIn: true,
} as IChatModelConfig;

const isProviderReady = (provider: IChatProviderConfig) => {
  if (!provider.apiBase) {
    return false;
  }
  try {
    const url = new URL(provider.apiBase);
    const isReady = ['http:', 'https:'].includes(url.protocol);
    if (isReady) {
      const builtIn = getBuiltInProvider(provider.name as ProviderType);
      if (builtIn?.options?.isApiKeyOptional) {
        return true;
      }
      return !provider.schema.includes('key') || !isBlank(provider.apiKey);
    }
    return false;
  } catch {
    return false;
  }
};

const sortByName = (a: { name: string }, b: { name: string }) => {
  const aName = a.name || '';
  const bName = b.name || '';

  // Split into letters and numbers
  const aIsNum = /^\d/.test(aName);
  const bIsNum = /^\d/.test(bName);

  // If one starts with number and other with letter, letter comes first
  if (aIsNum && !bIsNum) return 1;
  if (!aIsNum && bIsNum) return -1;

  // Otherwise use normal string comparison
  return aName.localeCompare(bName);
};

const isModelReady = (
  modelExtras: string[],
  model: IChatModelConfig,
): boolean => {
  return modelExtras.every((key: string) => {
    return (
      !isNil(model.extras?.[key]) &&
      (model.extras?.[key] as string).trim() !== ''
    );
  });
};

type RemoteCatalogModel = {
  id?: string;
  name?: string;
  type?: string;
  input_modalities?: string[];
  output_modalities?: string[];
};

const isTextOnly = (modalities?: string[]) =>
  Array.isArray(modalities) &&
  modalities.length > 0 &&
  modalities.every((modality) => modality === 'text');

// CloudGPU lists chat, image, transcription and speech rows on one endpoint.
const isRemoteChatModel = (providerName: string, model: RemoteCatalogModel) => {
  const modelId = (model.id || model.name) as string;
  if (modelId.indexOf('embed') >= 0) {
    return false;
  }
  if (providerName !== 'CloudGPU') {
    return true;
  }
  return (
    model.type === 'chat' &&
    isTextOnly(model.input_modalities) &&
    isTextOnly(model.output_modalities)
  );
};

const mergeRemoteModel = (
  modelName: string,
  customModel?: IChatModelConfig,
) => {
  return {
    id: modelName,
    name: modelName,
    label:
      customModel?.label ||
      (modelName === ERROR_MODEL ? 'Invalid Model' : modelName),
    isReady: modelName !== ERROR_MODEL,
    isDefault: customModel?.isDefault || false,
    contextWindow: customModel?.contextWindow || DEFAULT_CONTEXT_WINDOW,
    capabilities: customModel?.capabilities || {},
    maxTokens: customModel?.maxTokens || MAX_TOKENS,
    defaultMaxTokens: customModel?.defaultMaxTokens || DEFAULT_MAX_TOKENS,
    inputPrice: customModel?.inputPrice || 0,
    outputPrice: customModel?.outputPrice || 0,
    description: customModel?.description || '',
    isFromApi: true,
    isBuiltIn: true, // remote models are always built-in
    disabled: customModel?.disabled || false,
  } as IChatModelConfig;
};

const getMergedLocalModels = (provider: IChatProviderConfig) => {
  const builtInProviders = getBuiltInProviders();
  const builtinModels =
    builtInProviders.find((p) => p.name === provider.name)?.chat.models || [];
  const userCreatedModels =
    provider?.models
      ?.filter((model: IChatModelConfig) => {
        return (
          !provider.isBuiltIn ||
          !builtinModels?.some(
            (builtInModel: IChatModel) => builtInModel.id === model.id,
          )
        );
      })
      .map((model) => {
        model.isBuiltIn = false;
        model.label = model.label || model.name;
        model.isReady = model.name !== ERROR_MODEL;
        return model;
      }) || [];
  const customModels = keyBy(provider?.models || [], 'id');
  return [
    ...(builtinModels?.map((model) => {
      const customModel = customModels[model.id];
      const mergedModel = {
        id: model.id,
        name: customModel?.name || model.name,
        label: customModel?.label || model.label || model.name,
        contextWindow: customModel?.contextWindow || model.contextWindow,
        maxTokens: customModel?.maxTokens || model.maxTokens,
        defaultMaxTokens:
          customModel?.defaultMaxTokens || model.defaultMaxTokens,
        inputPrice: customModel?.inputPrice || model.inputPrice,
        outputPrice: customModel?.outputPrice || model.outputPrice,
        description: customModel?.description || model.description || null,
        isDefault: customModel?.isDefault,
        isBuiltIn: true,
        isPremium: provider.isPremium,
        noStreaming: model.noStreaming || false,
        disabled: customModel?.disabled || false,
        capabilities: customModel?.capabilities || model.capabilities || {},
        extras: { ...model.extras, ...customModel?.extras },
      } as IChatModelConfig;
      mergedModel.isReady = isModelReady(
        provider.modelExtras as string[],
        mergedModel,
      );
      return mergedModel;
    }) || []),
    ...userCreatedModels,
  ].sort(sortByName);
};

export type ModelOption = {
  label: string;
  name: string;
  isReady: boolean;
  isDefault: boolean;
};

// for migrating settings from old version
const migrateSettings = () => {
  const settings = window.electron.store.get('settings');
  if (!settings?.api) return;
  const customProviders = window.electron.store.get('providers');
  if (customProviders?.length > 0) return;
  const legacyDefaultProvider = settings.api.activeProvider;
  const legacyProviders = settings.api.providers;
  if (legacyProviders) {
    const newProviders = Object.values(legacyProviders).map(
      (legacyProvider: any) => ({
        name: legacyProvider.provider,
        description: legacyProvider.description,
        apiKey: legacyProvider.key,
        apiBase: legacyProvider.base,
        apiSecret: legacyProvider.secret,
        apiVersion: legacyProvider.version,
        models: [],
        isDefault: legacyProvider.provider === legacyDefaultProvider,
      }),
    );
    window.electron.store.set('providers', newProviders);
  }
  const newSettings = { ...settings };
  delete newSettings.api;
  window.electron.store.set('settings', newSettings);
};
migrateSettings();

const mergeProviders = (
  custom?: IChatProviderConfig[],
): IChatProviderConfig[] => {
  const customProviders = keyBy(
    custom || window.electron.store.get('providers'),
    'name',
  );
  const builtInProviders = keyBy(getBuiltInProviders(), 'name');
  const mergedProviders = unionBy(
    [...Object.values(customProviders), ...Object.values(builtInProviders)],
    'name',
  ).map((provider) => {
    const customProvider = customProviders[provider.name];
    const builtInProvider = builtInProviders[provider.name];
    const defaultProvider = { ...OpenAI };
    defaultProvider.options.isApiKeyOptional = true; // Providers derived from OpenAI do not require API keys by default
    const mergedProvider = {
      name: provider.name,
      referral: builtInProvider?.referral,
      description:
        customProvider?.description || builtInProvider?.description || '',
      schema: builtInProvider?.chat?.apiSchema || ['base'],
      proxy: customProvider?.proxy || '',
      apiBase: customProvider?.apiBase || builtInProvider?.apiBase,
      apiKey: customProvider?.apiKey || '',
      apiVersion: customProvider?.apiVersion || builtInProvider?.apiVersion,
      temperature: (builtInProvider || defaultProvider).chat.temperature,
      topP: (builtInProvider || defaultProvider).chat.topP,
      presencePenalty: (builtInProvider || defaultProvider).chat
        .presencePenalty,
      currency:
        customProvider?.currency ||
        (builtInProvider || defaultProvider).currency,
      isDefault: customProvider?.isDefault || false,
      isPremium: !!builtInProvider?.isPremium,
      disabled: customProvider?.disabled || false,
      isBuiltIn: !!builtInProvider,
      modelExtras: builtInProvider?.chat.modelExtras || [],
      modelsEndpoint: builtInProvider?.options?.modelsEndpoint,
      isReady: false,
      models: customProvider?.models || [],
    } as IChatProviderConfig;
    mergedProvider.isReady = isProviderReady(mergedProvider);
    return mergedProvider;
  });
  return mergedProviders.sort(sortByName);
};

// 添加缓存相关的类型和对象
interface ModelCache {
  models: IChatModelConfig[];
  timestamp: number;
}

const modelsCache: Record<string, ModelCache> = {};
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 mins

export interface IProviderStore {
  providers: IChatProviderConfig[];
  provider: IChatProviderConfig | null;
  setProvider: (provider: IChatProviderConfig) => IChatProviderConfig;
  createProvider: (providerName?: string) => void;
  updateProvider: (
    name: string,
    provider: Partial<IChatProviderConfig>,
  ) => void;
  overwrite: (providers: IChatProviderConfig[]) => void;
  deleteProvider: (providerName: string) => void;
  isProviderDuplicated: (providerName: string) => boolean;
  getDefaultProvider: () => IChatProviderConfig;
  getAvailableProviders: (options?: {
    withDisabled?: boolean;
  }) => IChatProviderConfig[];
  getAvailableProvider: (providerName: string) => IChatProviderConfig;
  getAvailableModel: (
    providerName: string,
    modelName: string,
  ) => IChatModelConfig;
  getModelsSync: (
    provider: IChatProviderConfig,
    options?: { withDisabled?: boolean },
  ) => IChatModelConfig[];
  getModels: (
    provider: IChatProviderConfig,
    options?: { withDisabled?: boolean; signal?: AbortSignal },
  ) => Promise<IChatModelConfig[]>;
  getGroupedModelOptions: () => Promise<{
    [key: string]: ModelOption[];
  }>;
  createModel: (model: IChatModelConfig) => void;
  updateModel: (model: Partial<IChatModelConfig> & { id: string }) => void;
  deleteModel: (modelId: string) => void;
  clearModelsCache: (providerName?: string) => void;
}

const useProviderStore = create<IProviderStore>((set, get) => ({
  providers: mergeProviders(),
  provider: null,
  setProvider: (provider: IChatProviderConfig) => {
    set({ provider });
    return provider;
  },
  overwrite: (providers: IChatProviderConfig[]) => {
    const { provider } = get();
    window.electron.store.set('providers', providers);
    const mergedProviders = mergeProviders(providers);
    set({ providers: mergedProviders });
    if (provider) {
      const newProvider = mergedProviders.find((p) => p.name === provider.name);
      if (newProvider) {
        set({ provider: newProvider });
      } else {
        set({ provider: mergedProviders[0] });
      }
    }
  },
  createProvider: (providerName = 'Untitled') => {
    const { providers } = get();
    const names = providers.map((provider) => provider.name);
    const defaultName = genDefaultName(names, providerName);
    const newProvider = {
      name: defaultName,
      apiBase: '',
      currency: 'USD',
      apiKey: '',
      isDefault: false,
      models: [],
      disabled: false,
    } as Partial<IChatProviderConfig>;
    const customProviders = window.electron.store.get('providers') || [];
    const newCustomProviders = (
      [...customProviders, newProvider] as IChatProviderConfig[]
    ).sort(sortByName);
    window.electron.store.set('providers', newCustomProviders);
    const newProviders = mergeProviders(newCustomProviders);
    set({
      provider: find(newProviders, { name: defaultName }),
      providers: newProviders,
    });
  },
  updateProvider: (name: string, provider: Partial<IChatProviderConfig>) => {
    const { clearModelsCache } = get();
    const customProviders = window.electron.store.get('providers') || [];
    let found = false;
    const newProvider = omit(provider, ['isBuiltIn', 'isReady', 'isPremium']);
    const updatedProviders = customProviders.map(
      (providerItem: IChatProviderConfig) => {
        if (providerItem.name === name) {
          found = true;
          return {
            ...providerItem,
            ...newProvider,
          };
        }
        if (provider.isDefault) {
          providerItem.isDefault = false;
        }
        return providerItem;
      },
    ) as IChatProviderConfig[];
    if (!found) {
      updatedProviders.push({ ...newProvider, name } as IChatProviderConfig);
    }

    // 清除该提供商的缓存
    clearModelsCache(name);

    window.electron.store.set('providers', updatedProviders);
    const providers = mergeProviders(updatedProviders);
    set({ providers });
    if (get().provider?.name === name) {
      set({
        provider:
          providers.find((p) => p.name === (provider.name || name)) || null,
      });
    }
  },
  deleteProvider: (providerName: string) => {
    const customProviders = window.electron.store.get('providers');
    const updatedProviders = customProviders.filter(
      (providerItem: IChatProviderConfig) => {
        return providerItem.name !== providerName;
      },
    ) as IChatProviderConfig[];
    window.electron.store.set('providers', updatedProviders);
    const newProviders = mergeProviders(updatedProviders);
    const { provider } = get();
    if (provider?.name === providerName) {
      set({ provider: newProviders[0] });
    }
    set({ providers: newProviders });
  },
  isProviderDuplicated: (providerName: string) => {
    const { providers } = get();
    return providers.map((provider) => provider.name).includes(providerName);
  },
  getAvailableProviders: ({
    withDisabled,
  }: { withDisabled?: boolean } = {}) => {
    const { providers } = get();
    const enabledProviders = providers.filter(
      (p) => withDisabled || !p.disabled,
    );
    const session = useAuthStore.getState().getSession();
    if (session) return enabledProviders;
    return enabledProviders.filter((p) => !p.isPremium);
  },
  getAvailableProvider: (providerName: string) => {
    const { getAvailableProviders } = get();
    const providers = getAvailableProviders();
    return (
      find(providers, { name: providerName }) ||
      find(providers, { isDefault: true }) ||
      providers[0]
    );
  },
  getDefaultProvider: () => {
    const { getAvailableProviders } = get();
    const providers = getAvailableProviders();
    return find(providers, { isDefault: true }) || providers[0];
  },
  getAvailableModel: (providerName: string, modelName: string) => {
    const { getModelsSync, getAvailableProvider } = get();
    const provider = getAvailableProvider(providerName);
    if (provider.modelsEndpoint) {
      const customModel = provider.models.find(
        (m: IChatModelConfig) => m.name === modelName,
      );
      return mergeRemoteModel(modelName, customModel);
    }
    const models = getModelsSync(provider, { withDisabled: false });
    return (
      find(models, { name: modelName }) ||
      find(models, { isDefault: true }) ||
      models[0] ||
      ErrorModel
    );
  },
  getModelsSync: (
    provider: IChatProviderConfig,
    options?: { withDisabled?: boolean },
  ) => {
    let $models = [];
    if (provider.modelsEndpoint) {
      $models = provider.models.map((model) => {
        const customModel = provider.models.find(
          (m: IChatModelConfig) => m.name === model.name,
        );
        return mergeRemoteModel(model.name, customModel);
      });
    } else {
      $models = getMergedLocalModels(provider);
    }
    if (options?.withDisabled) {
      return $models;
    }
    return $models.filter((model) => !model.disabled);
  },
  getModels: async (
    provider: IChatProviderConfig,
    options?: {
      withDisabled?: boolean;
      signal?: AbortSignal;
      forceRefresh?: boolean;
    },
  ) => {
    let $models: IChatModelConfig[] = [];
    if (provider.modelsEndpoint) {
      // 为每个提供商生成唯一的缓存键
      const cacheKey = `${provider.name}_${provider.apiBase}_${provider.modelsEndpoint}`;
      const now = Date.now();

      // 检查缓存是否有效且未过期，同时确保不是强制刷新
      if (
        !options?.forceRefresh &&
        modelsCache[cacheKey] &&
        now - modelsCache[cacheKey].timestamp < CACHE_EXPIRY_TIME
      ) {
        $models = modelsCache[cacheKey].models;
      } else {
        const modelsMap = keyBy(provider.models || [], 'name');
        try {
          const headers = {
            'Content-Type': 'application/json',
          } as any;
          if (provider.apiKey) {
            headers.Authorization = `Bearer ${provider.apiKey}`;
          }
          const resp = await fetch(
            `${provider.apiBase}${provider.modelsEndpoint}`,
            {
              method: 'GET',
              headers,
              signal: options?.signal,
            },
          );
          const data = await resp.json();
          $models = (data.models || data.data || [])
            .filter((model: RemoteCatalogModel) =>
              isRemoteChatModel(provider.name, model),
            )
            .map((model: RemoteCatalogModel) => {
              const modelName = (model.id || model.name) as string;
              const customModel = modelsMap[modelName];
              delete modelsMap[modelName];
              return mergeRemoteModel(modelName, {
                ...customModel,
                isFromApi: true,
              });
            });

          // 更新缓存
          modelsCache[cacheKey] = {
            models: $models,
            timestamp: now,
          };
        } catch (e) {
          $models = [ErrorModel];
        }
      }
    } else {
      $models = getMergedLocalModels(provider);
    }
    if (options?.withDisabled) {
      return $models;
    }
    return $models.filter((model) => !model.disabled);
  },
  getGroupedModelOptions: async () => {
    const { getAvailableProviders, getModels } = get();
    const result: { [key: string]: ModelOption[] } = {};
    const providers = getAvailableProviders();
    await Promise.all(
      providers.map(async (provider) => {
        const models = await getModels(provider);
        result[provider.name] = models
          .map((model) => ({
            label: model.label || model.name,
            name: model.name,
            isReady: model.isReady,
            isDefault: model.isDefault || false,
          }))
          .filter((model: ModelOption) => model.name !== ERROR_MODEL);
        return provider;
      }),
    );
    return pickBy(result, (val: ModelOption[]) => val.length > 0);
  },
  createModel: (model: IChatModelConfig) => {
    const { provider, updateProvider } = get();
    if (!provider) return;
    const customProviders = window.electron.store.get('providers');
    const customProvider = customProviders.find(
      (p: IChatProviderConfig) => p.name === provider.name,
    ) || {
      models: [],
    };
    model.id = typeid('mod').toString();
    const newModel = omit(model, ['isBuiltIn', 'isReady']) as IChatModelConfig;
    const updatedProvider = {
      name: provider.name,
      models: [...(customProvider.models || []), newModel],
    };
    updateProvider(provider.name, updatedProvider);
  },

  updateModel: (model: Partial<IChatModelConfig> & { id: string }) => {
    const { provider, updateProvider } = get();
    if (!provider) return;
    const customProviders = window.electron.store.get('providers') || [];
    const customProvider = customProviders.find(
      (p: IChatProviderConfig) => p.name === provider.name,
    ) || {
      models: [],
    };
    let found = false;
    const newModel = omit(model, ['isBuiltIn', 'isReady']) as IChatModelConfig;
    const updatedModels =
      customProvider.models?.map((m: IChatModelConfig) => {
        if (m.id === model.id) {
          found = true;
          return { ...m, ...newModel };
        }
        if (model.isDefault) {
          m.isDefault = false;
        }
        return m;
      }) || [];
    if (!found) {
      updatedModels.push({ ...newModel } as IChatModelConfig);
    }
    const updatedProvider = {
      name: provider.name,
      models: updatedModels,
    };
    updateProvider(provider.name, updatedProvider);
  },

  deleteModel: (modelId: string) => {
    const { provider, updateProvider } = get();
    if (!provider) return;
    const customProviders = window.electron.store.get('providers');
    const customProvider = customProviders.find(
      (p: IChatProviderConfig) => p.name === provider.name,
    ) || {
      models: [],
    };
    const updatedProvider = {
      name: provider.name,
      models: customProvider.models.filter(
        (model: IChatModelConfig) => model.id !== modelId,
      ),
    };
    updateProvider(provider.name, updatedProvider);
  },

  clearModelsCache: (providerName?: string) => {
    if (providerName) {
      // 清除特定提供商的缓存
      Object.keys(modelsCache).forEach((key) => {
        if (key.startsWith(`${providerName}_`)) {
          delete modelsCache[key];
        }
      });
    } else {
      // 清除所有缓存
      Object.keys(modelsCache).forEach((key) => {
        delete modelsCache[key];
      });
    }
  },
}));

export default useProviderStore;
