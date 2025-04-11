import Debug from 'debug';
import { create } from 'zustand';
import { isNil, pick, set } from 'lodash';
import { getProvider } from 'providers';
import {
  IModelMapping,
  IToolStates,
  LanguageType,
  IAPISettings,
  ISettings,
} from '../types/settings.d';
/* eslint-disable no-console */

import { FontSize, ThemeType } from '../types/appearance';

const debug = Debug('5ire:stores:useSettingsStore');

const defaultTheme = 'system';
const defaultLanguage = 'system';
const defaultFontSize = 'base';

const defaultAPI: IAPISettings = {
  provider: 'OpenAI',
  base: 'https://api.openai.com/v1',
  key: '',
  model: '',
};

const defaultModelMapping: IModelMapping = {};
const defaultToolStates: IToolStates = {};

export interface ISettingStore {
  theme: ThemeType;
  language: LanguageType;
  fontSize: FontSize;
  api: IAPISettings;
  modelMapping: IModelMapping;
  toolStates: IToolStates;
  setTheme: (theme: ThemeType) => void;
  setAPI: (api: Partial<IAPISettings>) => void;
  setModelMapping: (modelMapping: IModelMapping) => void;
  setToolState: (
    providerName: string,
    modelName: string,
    state: boolean,
  ) => void;
  getToolState: (
    providerName: string,
    modelName: string,
  ) => boolean | undefined;
  setLanguage: (language: LanguageType) => void;
  setFontSize: (fontSize: FontSize) => void;
}

const settings = window.electron.store.get('settings', {}) as ISettings;
let apiSettings = defaultAPI;
if (settings.api?.activeProvider) {
  apiSettings =
    settings.api.providers[settings.api.activeProvider] || defaultAPI;
}

const useSettingsStore = create<ISettingStore>((set, get) => ({
  theme: settings?.theme || defaultTheme,
  language: settings?.language || defaultLanguage,
  fontSize: settings?.fontSize || defaultFontSize,
  modelMapping: settings.modelMapping || defaultModelMapping,
  toolStates: settings.toolStates || defaultToolStates,
  api: apiSettings,
  setTheme: async (theme: ThemeType) => {
    set({ theme });
    window.electron.store.set('settings.theme', theme);
  },
  setAPI: (api: Partial<IAPISettings>) => {
    set((state) => {
      const provider = isNil(api.provider) ? state.api.provider : api.provider;
      const base = isNil(api.base) ? state.api.base : api.base;
      const key = isNil(api.key) ? state.api.key : api.key;
      const secret = isNil(api.secret) ? state.api.secret : api.secret;
      const model = isNil(api.model) ? state.api.model : api.model;
      const deploymentId = isNil(api.deploymentId)
        ? state.api.deploymentId
        : api.deploymentId;
      const newAPI = {
        provider,
        base,
        key,
        secret,
        deploymentId,
        model,
      } as IAPISettings;
      const { apiSchema } = getProvider(provider).chat;
      window.electron.store.set('settings.api.activeProvider', provider);
      window.electron.store.set(
        `settings.api.providers.${provider}`,
        pick(newAPI, [...apiSchema, 'provider']),
      );
      return { api: newAPI };
    });
  },
  setModelMapping: (modelMapping: IModelMapping) => {
    set({ modelMapping });
    window.electron.store.set('settings.modelMapping', modelMapping);
  },
  setToolState(providerName: string, modelName: string, state: boolean) {
    set((currentState) => {
      const key = `${providerName}.${modelName}`;
      const newToolStates = { ...currentState.toolStates, [key]: state };
      window.electron.store.set('settings.toolStates', newToolStates);
      return { toolStates: newToolStates };
    });
  },
  getToolState(providerName: string, modelName: string) {
    return get().toolStates[`${providerName}.${modelName}`];
  },
  setLanguage: (language: 'en' | 'zh' | 'system') => {
    set({ language });
    window.electron.store.set('settings.language', language);
  },
  setFontSize: (fontSize: FontSize) => {
    set({ fontSize });
    window.electron.store.set('settings.fontSize', fontSize);
  },
}));

export default useSettingsStore;
