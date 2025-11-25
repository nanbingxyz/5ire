import { useEffect, useMemo } from 'react';
import Debug from 'debug';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import {
  FluentProvider,
  Toaster,
  BrandVariants,
  createLightTheme,
  Theme,
  createDarkTheme,
} from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import Providers from 'renderer/pages/providers';
import useUI from 'hooks/useUI';
import usePlatform from 'hooks/usePlatform';
import { captureException } from '../logging';
import useSettingsStore from '../../stores/useSettingsStore';
import useAppearanceStore from '../../stores/useAppearanceStore';
import AppHeader from './layout/AppHeader';
import AppSidebar from './layout/aside/AppSidebar';
import StartupHandler from './StartupHandler';
import Chat from '../pages/chat';
import Knowledge from '../pages/knowledge';
import KnowledgeCollectionForm from '../pages/knowledge/CollectionForm';
import Tools from '../pages/tool';
import Bookmarks from '../pages/bookmark';
import Bookmark from '../pages/bookmark/Bookmark';
import Usage from '../pages/usage';
import Login from '../pages/user/Login';
import Register from '../pages/user/Register';
import Account from '../pages/user/Account';
import Settings from '../pages/settings';
import Prompts from '../pages/prompt';
import PromptForm from '../pages/prompt/Form';
import AppLoader from '../apps/Loader';
import ToolSetup from './ToolSetup';
import WindowsTitleBar from './layout/WindowsTitleBar';

const debug = Debug('5ire:components:FluentApp');

const fire: BrandVariants = {
  10: '#030303',
  20: '#171717',
  30: '#252525',
  40: '#313131',
  50: '#3D3D3D',
  60: '#494949',
  70: '#565656',
  80: '#636363',
  90: '#717171',
  100: '#7F7F7F',
  110: '#8D8D8D',
  120: '#9B9B9B',
  130: '#AAAAAA',
  140: '#B9B9B9',
  150: '#C8C8C8',
  160: '#D7D7D7',
};

// eslint-disable-next-line prefer-destructuring
const lightTheme: Theme = {
  ...createLightTheme(fire),
};

// eslint-disable-next-line prefer-destructuring
const darkTheme: Theme = {
  ...createDarkTheme(fire),
};

darkTheme.colorBrandForeground1 = fire[120];
darkTheme.colorBrandForeground2 = fire[130];

export default function FluentApp() {
  const { i18n } = useTranslation();
  const { isDarwin } = usePlatform();
  const { heightStyle } = useUI();
  const themeSettings = useSettingsStore((state) => state.theme);
  const theme = useAppearanceStore((state) => state.theme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const language = useSettingsStore((state) => state.language);
  const setTheme = useAppearanceStore((state) => state.setTheme);

  const fontSizeCls = useMemo(() => {
    switch (fontSize) {
      case 'large':
        return 'font-lg';
      case 'xl':
        return 'font-xl';
      default:
        return 'font-base'; // default
    }
  }, [fontSize]);

  useEffect(() => {
    window.electron.ipcRenderer.on('native-theme-change', (_theme: unknown) => {
      if (themeSettings === 'system') {
        setTheme(_theme as 'light' | 'dark');
        debug(`Theme Change to: ${_theme}`);
      }
    });
    return () => {
      window.electron.ipcRenderer.unsubscribeAll('native-theme-change');
    };
  }, [themeSettings, setTheme]);

  useEffect(() => {
    if (themeSettings === 'system') {
      window.electron
        .getNativeTheme()
        .then((_theme) => {
          debug(`Theme: ${_theme}`);
          return setTheme(_theme);
        })
        .catch(captureException);
    } else {
      setTheme(themeSettings);
    }

    if (language === 'system') {
      window.electron
        .getSystemLanguage()
        .then((_lang) => {
          return i18n.changeLanguage(_lang);
        })
        .catch(captureException);
    } else {
      i18n.changeLanguage(language);
    }
  }, [themeSettings, setTheme, language, i18n]);

  return (
    <FluentProvider
      theme={theme === 'light' ? lightTheme : darkTheme}
      data-theme={theme}
      style={{ background: 'transparent' }}
    >
      <div className={`flex flex-col h-screen ${isDarwin ? '' : 'bg-sidebar'}`}>
        <div className="flex-1">
          <Router>
            {isDarwin ? <AppHeader /> : <WindowsTitleBar />}
            <StartupHandler />

            <Toaster toasterId="toaster" limit={5} offset={{ vertical: 25 }} />
            <div
              className={`relative flex  w-full overflow-hidden main-container ${fontSizeCls}`}
              style={{
                height: heightStyle(),
              }}
            >
              <AppSidebar />
              <main
                className={`relative px-5 flex h-full w-full flex-col overflow-hidden  ${isDarwin ? 'darwin' : 'border-l border-t border-base rounded-tl-lg'}`}
              >
                <Routes>
                  <Route index element={<Chat />} />
                  <Route path="/chats/:id?/:anchor?" element={<Chat />} />
                  <Route path="/knowledge" element={<Knowledge />} />
                  <Route
                    path="/knowledge/collection-form/:id?"
                    element={<KnowledgeCollectionForm />}
                  />
                  <Route path="/tool" element={<Tools />} />
                  <Route path="/apps/:key" element={<AppLoader />} />
                  <Route path="/bookmarks" element={<Bookmarks />} />
                  <Route path="/bookmarks/:id" element={<Bookmark />} />
                  <Route path="/user/login" element={<Login />} />
                  <Route path="/user/register" element={<Register />} />
                  <Route path="/user/account" element={<Account />} />
                  <Route path="/usage" element={<Usage />} />
                  <Route path="/prompts" element={<Prompts />} />
                  <Route path="/prompts/form/:id?" element={<PromptForm />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/providers" element={<Providers />} />
                </Routes>
                <div
                  id="portal"
                  style={{ zIndex: 9999999, position: 'absolute' }}
                />
              </main>
            </div>
            <ToolSetup />
          </Router>
        </div>
      </div>
    </FluentProvider>
  );
}
