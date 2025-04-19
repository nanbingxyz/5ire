import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { DEFAULT_MAX_TOKENS, NUM_CTX_MESSAGES } from 'consts';
import { useMemo } from 'react';
import { find, isNil, isNumber } from 'lodash';
import { isValidMaxTokens, isValidTemperature } from 'intellichat/validators';

import { IChat, IChatContext, IChatMessage, IPrompt } from 'intellichat/types';
import {
  IChatModel,
  IChatModelConfig,
  IChatProviderConfig,
} from 'providers/types';
import useProviderStore from 'stores/useProviderStore';

// const debug = Debug('5ire:hooks:useChatContext');

export default function useChatContext(): IChatContext {
  const { getAvailableProvider, getDefaultProvider, getAvailableModel } =
    useProviderStore();

  const context = useMemo(() => {
    const getActiveChat = () => {
      const { chat } = useChatStore.getState();
      return chat as IChat;
    };

    const getProvider = () => {
      const { chat } = useChatStore.getState();
      if (chat.provider) {
        return getAvailableProvider(chat.provider);
      }
      return getDefaultProvider();
    };

    const getModel = () => {
      const { chat } = useChatStore.getState();
      console.log('getModel', chat);
      if (chat.provider && chat.model) {
        return getAvailableModel(chat.provider, chat.model);
      }
      const provider = getProvider();
      return (
        (find(provider.models, { isDefault: true }) as IChatModelConfig) ||
        provider.models[0]
      );
    };

    const getSystemMessage = () => {
      const { chat } = useChatStore.getState();
      const prompt = chat.prompt as IPrompt | null;
      const systemMessage =
        prompt?.systemMessage || chat?.systemMessage || null;
      // debug(`Chat(${chat.id}):getSystemMessage: ${systemMessage}`);
      return systemMessage;
    };

    const getTemperature = (): number => {
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      let temperature = getAvailableProvider(api.provider)?.temperature
        .default as number;
      const prompt = chat.prompt as IPrompt | null;
      if (isValidTemperature(prompt?.temperature, api.provider)) {
        temperature = prompt?.temperature as number;
      }
      if (isValidTemperature(chat?.temperature, api.provider)) {
        temperature = chat?.temperature as number;
      }
      // debug(`Chat(${chat.id}):getTemperature: ${temperature}`);
      return temperature;
    };

    const getMaxTokens = () => {
      const { chat } = useChatStore.getState();
      const provider = getProvider() as IChatProviderConfig;
      const model = getModel() as IChatModelConfig;
      let maxTokens =
        model?.defaultMaxTokens || model?.maxTokens || DEFAULT_MAX_TOKENS;
      const prompt = chat.prompt as IPrompt | null;
      if (
        prompt?.maxTokens != null &&
        isValidMaxTokens(
          prompt?.maxTokens,
          provider.name,
          model?.name as string,
        )
      ) {
        maxTokens = prompt?.maxTokens || (prompt?.maxTokens as number);
      }
      if (
        chat?.maxTokens != null &&
        isValidMaxTokens(chat?.maxTokens, provider.name, model.name as string)
      ) {
        maxTokens = chat?.maxTokens as number;
      }
      // debug(`Chat(${chat.id}):getMaxTokens: ${maxTokens}`);
      return maxTokens as number;
    };

    const getChatContext = () => {
      const { chat } = useChatStore.getState();
      const chatContext = chat?.context || '';
      // debug(`Chat(${chat.id}):getChatContext: ${chatContext}`);
      return chatContext;
    };

    const isStream = () => {
      const { chat } = useChatStore.getState();
      let stream = true;
      if (!isNil(chat?.stream)) {
        stream = chat.stream;
      }
      // debug(`Chat(${chat.id}):isStream: ${stream}`);
      return stream;
    };

    const isToolsEnabled = () => {
      const model = getModel() as IChatModel;
      return model?.capabilities?.tools?.enabled || false;
    };

    const getCtxMessages = (msgId?: string) => {
      const { chat } = useChatStore.getState();
      let ctxMessages: IChatMessage[] = [];
      const maxCtxMessages = isNumber(chat?.maxCtxMessages)
        ? chat?.maxCtxMessages
        : NUM_CTX_MESSAGES;
      if (maxCtxMessages > 0) {
        let messages = useChatStore.getState().messages || [];
        if (msgId) {
          const index = messages.findIndex((m) => m.id === msgId);
          if (index > -1) {
            messages = messages.slice(0, index + 1);
          }
        }

        if (messages.length <= maxCtxMessages) {
          ctxMessages = messages.slice(0, -1);
        } else {
          // @NOTE: 去除最后一条外的最后的 maxCtxMessages 条 （最后一条是刚创建的）
          ctxMessages = messages.slice(
            -maxCtxMessages - 1,
            messages.length - 1,
          );
        }
      }
      // debug(`Chat(${chat.id}):getCtxMessages: ${ctxMessages.length} messages`);
      return ctxMessages;
    };

    const ctx = {
      getActiveChat,
      getProvider,
      getModel,
      getSystemMessage,
      getCtxMessages,
      getTemperature,
      getMaxTokens,
      getChatContext,
      isStream,
      isToolsEnabled,
    };
    return ctx;
  }, []);

  return context;
}
