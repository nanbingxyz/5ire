import { ProviderType } from 'providers/types';
import { ThemeType } from './appearance';

export type LanguageType = 'en' | 'zh' | 'system';

export interface IAPISettings {
  provider: ProviderType;
  base: string;
  key: string;
  model: string;
  secret?: string;
  deploymentId?: string;
  endpoint?: string;
}

export interface IChatModel {
  // Add properties for IChatModel as needed
}

export interface ISettings {
  theme: ThemeType;
  language: LanguageType;
  api: {
    activeProvider: string;
    providers: {
      [key: string]: IAPISettings;
    };
  };
  modelMapping: IModelMapping;
  ollama?: {
    models: Record<string, IChatModel>;
  };
}

export interface IModelMapping {
  [key: string]: string;
}
