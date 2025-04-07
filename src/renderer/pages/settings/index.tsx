import { useTranslation } from 'react-i18next';
import {
  CloudArrowUp24Filled,
  CloudArrowUp24Regular,
  CloudArrowDown20Filled,
  CloudArrowDown20Regular,
  bundleIcon,
  MoreHorizontal24Filled,
} from '@fluentui/react-icons';
import Debug from 'debug';
import './Settings.scss';
import useAuthStore from 'stores/useAuthStore';
import useToast from 'hooks/useToast';
import { useEffect, useState } from 'react';
import StateButton from 'renderer/components/StateButton';
import supabase from 'vendors/supa';
import useSettingsStore from 'stores/useSettingsStore';
import {
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import { captureException } from '../../logging';

import AppearanceSettings from './AppearanceSettings';
import APISettings from './APISettings';
import EmbedSettings from './EmbedSettings';
import LanguageSettings from './LanguageSettings';

const debug = Debug('5ire:pages:settings:index');

const CloudArrowUpIcon = bundleIcon(
  CloudArrowUp24Filled,
  CloudArrowUp24Regular,
);

const CloudArrowDownIcon = bundleIcon(
  CloudArrowDown20Filled,
  CloudArrowDown20Regular,
);

export default function Settings() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { notifyInfo, notifyError, notifySuccess } = useToast();
  const [updated, setUpdated] = useState(true);
  const [loading, setLoading] = useState(false);

  const [updatedAtCloud, setUpdatedAtCloud] = useState<string>();

  useEffect(() => {
    if (!user || !updated) {
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('updated_at')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          notifyError(error.message);
        } else if (data?.updated_at) {
          const dt = new Date(data.updated_at);
          setUpdatedAtCloud(dt.toLocaleString());
          setUpdated(false);
        } else {
          setUpdatedAtCloud(undefined);
        }
      } catch (error) {
        debug(error);
        captureException(error as Error);
      }
    })();
  }, [user, updated, notifyError]);

  const restoreFromCloud = async () => {
    if (!user) {
      notifyInfo(t('Auth.Notification.SignInRequired'));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        notifyError(error.message);
      } else if (data?.data) {
        const { iv, encrypted } = data.data;
        const decrypted = await window.electron.crypto.decrypt(
          encrypted,
          user.id,
          iv,
        );
        const { theme, api } = JSON.parse(decrypted);
        const apiSettings = api.providers[api.activeProvider];
        useSettingsStore.getState().setTheme(theme);
        useSettingsStore.getState().setAPI(apiSettings);
        notifySuccess(t('Settings.Notification.RestoreFromCloudSuccess'));
      } else {
        notifyError(t('Settings.Notification.RestoreFromCloudFailed'));
      }
    } catch (error: any) {
      debug(error);
      captureException(error);
    } finally {
      setLoading(false);
    }
  };

  const saveToCloud = async () => {
    if (!user) {
      notifyInfo(t('Auth.Notification.SignInRequired'));
      return;
    }
    setLoading(true);
    try {
      const { theme } = useSettingsStore.getState();
      const { api } = window.electron.store.get('settings');
      const encrypted = await window.electron.crypto.encrypt(
        JSON.stringify({ theme, api }),
        user.id,
      );
      const { error } = await supabase
        .from('settings')
        .upsert({ data: encrypted, id: user.id });
      if (error) {
        notifyError(error.message);
      } else {
        notifySuccess(t('Settings.Notification.SaveToCloudSuccess'));
        setUpdated(true);
      }
    } catch (error: any) {
      debug(error);
      captureException(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page h-full" id="page-settings">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl">{t('Common.Settings')}</h1>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <MenuButton
                appearance="transparent"
                icon={<MoreHorizontal24Filled />}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<CloudArrowUpIcon />} onClick={saveToCloud}>
                  {' '}
                  {t('Settings.Action.SaveToCloud')}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
        {updatedAtCloud && (
          <MessageBar intent="success" className="mt-4 -mb-4">
            <MessageBarBody>
              <span className="latin">
                {t('Settings.Info.UpdatedAtCloud')}&nbsp;{updatedAtCloud}
              </span>
            </MessageBarBody>
            <MessageBarActions>
              <StateButton
                loading={loading}
                appearance="subtle"
                icon={<CloudArrowDownIcon />}
                onClick={restoreFromCloud}
              >
                {t('Settings.Action.DownloadFromCloud')}
              </StateButton>
            </MessageBarActions>
          </MessageBar>
        )}
      </div>
      <div className="overflow-y-auto h-full pb-28 -mr-5 pr-5">
        <APISettings />
        <EmbedSettings />
        <AppearanceSettings />
        <LanguageSettings />

      </div>
    </div>
  );
}
