import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Debug from 'debug';
import useChatStore from 'stores/useChatStore';

const debug = Debug('5ire:components:StartupHandler');

/**
 * Component to handle startup arguments for auto-creating chats
 * Listens for startup-new-chat IPC events and creates chats accordingly
 */
export default function StartupHandler() {
  const navigate = useNavigate();
  const { createChat } = useChatStore();

  useEffect(() => {
    const unsubscribe = window.electron.startup.onNewChat(async (args) => {
      debug('Received startup args:', args);

      try {
        // Create chat with the provided arguments
        const chat = await createChat({
          provider: args.provider,
          model: args.model,
          systemMessage: args.system,
          summary: args.summary,
          temperature: args.temperature,
          input: args.prompt || '',
        });

        debug('Created chat from startup args:', chat.id);

        // Navigate to the newly created chat
        navigate(`/chats/${chat.id}`);
      } catch (error) {
        debug('Failed to create chat from startup args:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate, createChat]);

  // This component doesn't render anything
  return null;
}
