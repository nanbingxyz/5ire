import { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RadioGroup,
  Radio,
  RadioGroupOnChangeData,
} from '@fluentui/react-components';
import { captureException } from '../../logging';
import { FontSize, ThemeType } from '../../../types/appearance.d';
import useSettingsStore from '../../../stores/useSettingsStore';
import useAppearanceStore from '../../../stores/useAppearanceStore';

export default function AppearanceSettings() {
  const { t } = useTranslation();
  const { setTheme } = useAppearanceStore();
  const fontSize = useSettingsStore((state) => state.fontSize);
  const themeSetting = useSettingsStore((state) => state.theme);
  const setThemeSetting = useSettingsStore((state) => state.setTheme);
  const setFontSize = useSettingsStore((state) => state.setFontSize);

  const onThemeChange = (
    ev: FormEvent<HTMLDivElement>,
    data: RadioGroupOnChangeData,
  ) => {
    setThemeSetting(data.value as ThemeType);
    if (data.value === 'system') {
      window.electron
        .getNativeTheme()
        .then((_theme) => {
          window.electron.titleBarAPI.updateOverlay(_theme as ThemeType);
          return setTheme(_theme as ThemeType);
        })
        .catch(captureException);
    } else {
      window.electron.titleBarAPI.updateOverlay(data.value as ThemeType);
      setTheme(data.value as ThemeType);
    }
  };

  const onFontSizeChange = (
    ev: FormEvent<HTMLDivElement>,
    data: RadioGroupOnChangeData,
  ) => {
    setFontSize(data.value as FontSize);
  };
  return (
    <div className="settings-section">
      <div className="settings-section--header">{t('Common.Appearance')}</div>
      <div className="py-4 flex-grow">
        <p className="pt-1 pb-2">{t('Appearance.ColorTheme')}</p>
        <RadioGroup
          name="theme"
          aria-labelledby={t('Common.Appearance')}
          value={themeSetting}
          onChange={onThemeChange}
        >
          <Radio name="appearance" value="light" label={t('Common.Light')} />
          <Radio name="appearance" value="dark" label={t('Common.Dark')} />
          <Radio
            name="appearance"
            value="system"
            label={t('Appearance.System')}
          />
        </RadioGroup>
      </div>
      <div className="py-4 flex-grow">
        <p className="pt-1 pb-2">{t('Appearance.ChatFontSize')}</p>
        <RadioGroup
          name="fontSize"
          aria-labelledby={t('Common.FontSize')}
          value={fontSize}
          onChange={onFontSizeChange}
        >
          <Radio name="fontSize" value="base" label={t('Common.Normal')} />
          <Radio name="fontSize" value="large" label={t('Common.Large')} />
          <Radio name="fontSize" value="xl" label={t('Common.ExtraLarge')} />
        </RadioGroup>
      </div>
    </div>
  );
}
