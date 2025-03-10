import Debug from 'debug';

import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { DEFAULT_MAX_TOKENS, NUM_CTX_MESSAGES, tempChatId } from 'consts';
import { useMemo } from 'react';
import { isNil, isNumber, isUndefined } from 'lodash';
import { isValidMaxTokens, isValidTemperature } from 'intellichat/validators';

import useProvider from './useProvider';
import { IChat, IChatContext, IChatMessage, IPrompt } from 'intellichat/types';
import { IChatModel } from 'providers/types';

const debug = Debug('5ire:hooks:useChatContext');

/**
 * useChatContext hook
 *
 * This hook provides access to the current chat context, including the active chat,
 * provider, model, and various settings. It reacts to changes in the chat store
 * to ensure the UI is updated when the model or other settings change.
 */
export default function useChatContext(): IChatContext {
  const { getProvider: getChatProvider, getChatModel } = useProvider();
  
  // Get the current chat from the store to make the context reactive
  const chat = useChatStore(state => state.chat);
  const api = useSettingsStore(state => state.api);

  // Create the context with dependencies on chat and api to ensure it updates
  const context = useMemo(() => {
    const getActiveChat = () => {
      return {
        ...chat,
        isPersisted: !!(chat?.id && chat.id !== tempChatId),
      } as IChat;
    };

    const getProvider = () => {
      return getChatProvider(api.provider);
    };

    /**
     * Notice: 用户在切换服务商后，chat 使用的模型可能不再被支持
     * 因此要判断当前模型是否在支持的模型列表中，
     * 如果不在，则使用设置的模型
     */
    /**
     * Get the current model for the chat.
     * This function checks if the chat has a model set, and if so, returns that model.
     * Otherwise, it returns the default model from the API settings.
     */
    const getModel = () => {
      const defaultModel = { name: api.model, label: api.model } as IChatModel;
      const provider = getChatProvider(api.provider);
      
      // Only return defaultModel if there are no models
      if (!provider.chat.models || Object.keys(provider.chat.models).length === 0) {
        return defaultModel;
      }
      
      // Get the default model from the API settings
      let model = getChatModel(api.provider, api.model) || defaultModel;
      
      // For Azure, just return the model from API settings
      if (api.provider === 'Azure') {
        return model;
      }
      
      // If the chat has a model set, use that model
      if (chat?.model) {
        const chatModel = getChatModel(api.provider, chat.model);
        if (chatModel) {
          model = chatModel;
        }
      }
      
      return model;
    };

    const getSystemMessage = () => {
      const prompt = chat.prompt as IPrompt | null;
      const systemMessage =
        prompt?.systemMessage || chat?.systemMessage || null;
      // debug(`Chat(${chat.id}):getSystemMessage: ${systemMessage}`);
      return systemMessage;
    };

    const getTemperature = (): number => {
      let temperature = getChatProvider(api.provider).chat.temperature
        .default as number;
      const prompt = chat.prompt as IPrompt | null;
      if (isValidTemperature(prompt?.temperature, api.provider)) {
        temperature = prompt?.temperature as number;
      }
      if (isValidTemperature(chat?.temperature, api.provider)) {
        temperature = chat?.temperature as number;
      }
      // debug(`Chat(${chat.id}):getSystemMessage: ${temperature}`);
      return temperature;
    };

    const getMaxTokens = () => {
      const model = getModel();
      let maxTokens =
        model.defaultMaxTokens || model.maxTokens || DEFAULT_MAX_TOKENS;
      const prompt = chat.prompt as IPrompt | null;
      if (
        prompt?.maxTokens != null &&
        isValidMaxTokens(prompt?.maxTokens, api.provider, model.name)
      ) {
        maxTokens = prompt?.maxTokens || (prompt?.maxTokens as number);
      }
      if (
        chat?.maxTokens != null &&
        isValidMaxTokens(chat?.maxTokens, api.provider, model.name)
      ) {
        maxTokens = chat?.maxTokens as number;
      }
      // debug(`Chat(${chat.id}):getMaxTokens: ${maxTokens}`);
      return maxTokens as number;
    };

    const getChatContext = () => {
      const chatContext = chat?.context || '';
      // debug(`Chat(${chat.id}):getChatContext: ${chatContext}`);
      return chatContext;
    };

    const isStream = () => {
      let stream = true;
      if (!isNil(chat?.stream)) {
        stream = chat.stream;
      }
      // debug(`Chat(${chat.id}):isStream: ${stream}`);
      return stream;
    };

    const isToolEnabled = () => {
      const { getToolState } = useSettingsStore.getState();
      const model = getModel();
      let toolEnabled = getToolState(getProvider().name, model.name);
      if (isUndefined(toolEnabled)) {
        toolEnabled = model.toolEnabled || false;
      }
      return toolEnabled;
    };

    const getCtxMessages = () => {
      let ctxMessages: IChatMessage[] = [];
      const maxCtxMessages = isNumber(chat?.maxCtxMessages)
        ? chat?.maxCtxMessages
        : NUM_CTX_MESSAGES;
      if (maxCtxMessages > 0) {
        const messages = useChatStore.getState().messages || [];
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
      isToolEnabled,
    };
    return ctx;
  }, [chat, api]); // Add dependencies to ensure context updates when chat or api changes

  return context;
}
