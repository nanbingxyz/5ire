import Debug from 'debug';

import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { NUM_CTX_MESSAGES, tempChatId } from 'consts';
import { useMemo } from 'react';
import useStageStore from 'stores/useStageStore';
import { isNil, isNumber } from 'lodash';
import { isValidMaxTokens, isValidTemperature } from 'intellichat/validators';

import useProvider from './useProvider';
import { IChat, IChatContext, IChatMessage } from 'intellichat/types';
import { IChatModel } from 'providers/types';

const debug = Debug('5ire:hooks:useChatContext');

export default function useChatContext(): IChatContext{

  const { getProvider: getChatProvider, getChatModel } = useProvider();

  const context = useMemo(() => {
    const getActiveChat = () => {
      const { chat } = useChatStore.getState();
      // debug(`Chat(${chat.id}):getActiveChat: ${chat.summary}`);
      return {
        ...chat,
        isPersisted: !!(chat?.id && chat.id !== tempChatId),
      } as IChat;
    };

    const getProvider = () => {
      const { api } = useSettingsStore.getState();
      return getChatProvider(api.provider);
    };

    /**
     * Notice: 用户在切换服务商后，chat 使用的模型可能不再被支持
     * 因此要判断当前模型是否在支持的模型列表中，
     * 如果不在，则使用设置的模型
     */
    const getModel = () => {
      const { api } = useSettingsStore.getState();
      const defaultModel = { name: api.model, label: api.model } as IChatModel;
      // if(api.provider === 'Ollama'){
      //   return defaultModel;
      // }
      let model = getChatModel(api.provider, api.model) || defaultModel
      if(api.provider ==='Azure'){
        return model;
      }
      const { chat } = useChatStore.getState();
      if (chat?.model) {
        model = getChatModel(api.provider, chat.model) || model;
      }
      // debug(`Chat(${chat.id}):getModel: ${model.label}`);
      return model;
    };

    const getSystemMessage = () => {
      const chat = useChatStore.getState().chat;
      const prompt = useStageStore.getState().getPrompt(chat.id);
      const systemMessage =
        prompt?.systemMessage || chat?.systemMessage || null;
      // debug(`Chat(${chat.id}):getSystemMessage: ${systemMessage}`);
      return systemMessage;
    };

    const getTemperature = (): number => {
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      let temperature = getChatProvider(api.provider).chat.temperature
        .default as number;
      const prompt = useStageStore.getState().getPrompt(chat.id);
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
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      const model = getModel();
      let maxTokens = model.maxTokens || null;
      const prompt = useStageStore.getState().getPrompt(chat.id);
      if (prompt?.maxTokens != null && isValidMaxTokens(prompt?.maxTokens, api.provider, model.name)) {
        maxTokens = prompt?.maxTokens as number | null;
      }
      if (chat?.maxTokens != null && isValidMaxTokens(chat?.maxTokens, api.provider, model.name)) {
        maxTokens = chat?.maxTokens as number | null;
      }
      // debug(`Chat(${chat.id}):getMaxTokens: ${maxTokens}`);
      return maxTokens;
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

    const getCtxMessages = () => {
      const { chat } = useChatStore.getState();
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
            messages.length - 1
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
    };
    return ctx;
  }, []);

  return context;
}
