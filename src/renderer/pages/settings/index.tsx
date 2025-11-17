import { useTranslation } from 'react-i18next';

import './Settings.scss';

import { Link } from 'react-router-dom';
import usePlatform from 'hooks/usePlatform';
import Version from './Version';
import AppearanceSettings from './AppearanceSettings';
import EmbedSettings from './EmbedSettings';
import LanguageSettings from './LanguageSettings';
import MLflowSettings from './MLflowSettings';

export default function Settings() {
  const { isDarwin } = usePlatform();
  const { t } = useTranslation();

  return (
    <div className="page h-full" id="page-settings">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl">{t('Common.Settings')}</h1>
        </div>
      </div>
      <div
        className={`overflow-y-auto h-full  -mr-5 pr-5 ${isDarwin ? 'pb-28' : 'pb-16'}`}
      >
        <div className="settings-section">
          <div className="settings-section--header">{t('Common.API')}</div>
          <div className="py-4 flex-grow mt-1 gap-1">
            <span className="tips">
              {t('Settings.ProviderSettingsMovedTo')}&nbsp;
            </span>
            <Link to="/providers" className="underline">
              {t('Common.Providers')}
            </Link>
          </div>
        </div>
        <EmbedSettings />
        <MLflowSettings />
        <AppearanceSettings />
        <LanguageSettings />
        <Version />
      </div>
    </div>
  );
}
