import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Debug from 'debug';
import useChatStore from 'stores/useChatStore';
import useProviderStore from 'stores/useProviderStore';
import eventBus from 'utils/bus';
import { IStage } from 'intellichat/types';

const debug = Debug('5ire:components:StartupHandler');

/**
 * Component to handle startup arguments for auto-creating chats
 * Listens for startup-new-chat IPC events and creates chats accordingly
 */
export default function StartupHandler() {
  const navigate = useNavigate();
  const { createChat, editStage } = useChatStore();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = window.electron.startup.onNewChat(async (args) => {
      // Prevent race conditions if multiple events arrive quickly
      if (isProcessingRef.current) {
        debug('Already processing a startup event, ignoring duplicate');
        return;
      }

      isProcessingRef.current = true;
      debug('Received startup args:', args);

      try {
        const providerStore = useProviderStore.getState();

        const normalizeKey = (value?: string) =>
          (value || '')
            .toString()
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase();

        const providers = providerStore.getAvailableProviders({
          withDisabled: true,
        });

        const matchedProvider = args.provider
          ? providers.find(
              (provider) =>
                normalizeKey(provider.name) === normalizeKey(args.provider),
            )
          : undefined;

        const resolvedProvider = matchedProvider?.name || args.provider;

        let resolvedModel = args.model;
        if (matchedProvider && args.model) {
          const models = providerStore.getModelsSync(matchedProvider, {
            withDisabled: true,
          });
          const matchedModel = models.find(
            (model) => normalizeKey(model.name) === normalizeKey(args.model),
          );
          if (matchedModel) {
            resolvedModel = matchedModel.name;
          }
        }

        // Create chat with the provided arguments
        // Map CLI args to IChat properties correctly
        const chatData = {
          provider: resolvedProvider,
          model: resolvedModel,
          systemMessage: args.system,
          summary: args.summary || args.prompt?.substring(0, 50) || 'New Chat',
          name: args.summary,
          temperature: args.temperature,
          input: args.prompt ?? '',
        };
        
        debug('Creating chat with data:', chatData);
        const chat = await createChat(chatData);

        debug('Created chat from startup args:', chat);
        debug(
          'Chat provider:',
          chat.provider,
          'Chat model:',
          chat.model,
        );

        // Navigate to the newly created chat
        navigate(`/chats/${chat.id}`);

        // Force UI update by setting the stage with the correct provider/model
        // This ensures the ModelCtrl component displays the right values
        // Use longer delay to ensure chat context fully refreshes before auto-submit
        setTimeout(async () => {
          const stageUpdate: Partial<IStage> = {};
          if (resolvedProvider) stageUpdate.provider = resolvedProvider;
          if (resolvedModel) stageUpdate.model = resolvedModel;
          if (args.system) stageUpdate.systemMessage = args.system;
          if (args.temperature !== undefined) stageUpdate.temperature = args.temperature;
          
          if (Object.keys(stageUpdate).length > 0) {
            await editStage(chat.id, stageUpdate);
            debug('Updated chat stage with:', stageUpdate);
          }
          
          // If a prompt was provided, auto-submit it after context refresh
          if (args.prompt) {
            debug('Auto-submitting initial prompt:', args.prompt);
            // Additional delay to ensure chat page loaded the updated chat
            setTimeout(() => {
              eventBus.emit('startup-submit', args.prompt);
            }, 500);
          }
        }, 1000);
      } catch (error) {
        debug('Failed to create chat from startup args:', error);
      } finally {
        isProcessingRef.current = false;
      }
    });

    window.electron.ipcRenderer.sendMessage('startup-handler-ready');

    return () => {
      unsubscribe();
    };
  }, [navigate, createChat]);

  // This component doesn't render anything
  return null;
}
