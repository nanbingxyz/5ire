import Debug from 'debug';
import useAuthStore from 'stores/useAuthStore';
import { useEffect } from 'react';
import useToast from 'hooks/useToast';
import { useTranslation } from 'react-i18next';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useMCPStore from 'stores/useMCPStore';
import Mousetrap from 'mousetrap';
import FluentApp from './components/FluentApp';
import * as logging from './logging';

import './App.scss';
import './fluentui.scss';
import { ContextMenuProvider } from './components/ContextMenuProvider';

if (window.envVars.NODE_ENV === 'development') {
  Debug.enable('5ire:*');
}

const debug = Debug('5ire:App');

logging.init();

/**
 * Main application component that initializes the app and manages global state.
 * Handles authentication, MCP server initialization, and IPC communication setup.
 * 
 * @returns {JSX.Element} The main application wrapped in context providers
 */
export default function App() {
  const loadAuthData = useAuthStore((state) => state.load);
  const setSession = useAuthStore((state) => state.setSession);
  const { loadConfig, updateLoadingState } = useMCPStore();
  const { onAuthStateChange } = useAuthStore();
  const { notifyError } = useToast();
  const { t } = useTranslation();
  const { createFile } = useKnowledgeStore();

  useEffect(() => {
    loadAuthData();
    Mousetrap.prototype.stopCallback = () => {
      return false;
    };
    const subscription = onAuthStateChange();
    window.electron.mcp.init();
    window.electron.ipcRenderer.on(
      'mcp-server-loaded',
      async (serverNames: any) => {
        debug('🚩 MCP Server Loaded:', serverNames);
        loadConfig(true);
        updateLoadingState(false);
      },
    );

    window.electron.ipcRenderer.on('sign-in', async (authData: any) => {
      if (authData.accessToken && authData.refreshToken) {
        const { error } = await setSession(authData);
        if (error) {
          notifyError(error.message);
        }
      } else {
        debug('🚩 Invalid Auth Data:', authData);
        notifyError(t('Auth.Notification.LoginCallbackFailed'));
      }
    });

    /**
     * Handles knowledge base import completion events from the main process.
     * Creates a new file entry in the knowledge store when import succeeds.
     * This listener is placed at the app level to ensure it persists across component unmounts.
     * 
     * @param {unknown} data - Import completion data containing collection ID, file info, and chunk count
     */
    window.electron.ipcRenderer.on(
      'knowledge-import-success',
      (data: unknown) => {
        const { collectionId, file, numOfChunks } = data as any;
        createFile({
          id: file.id,
          collectionId,
          name: file.name,
          size: file.size,
          numOfChunks,
        });
      },
    );

    return () => {
      window.electron.ipcRenderer.unsubscribeAll('mcp-server-loaded');
      window.electron.ipcRenderer.unsubscribeAll('sign-in');
      window.electron.ipcRenderer.unsubscribeAll('knowledge-import-success');
      subscription.unsubscribe();
    };
  }, [loadAuthData, onAuthStateChange]);

  return (
    <ContextMenuProvider>
      <FluentApp />
    </ContextMenuProvider>
  );
}
