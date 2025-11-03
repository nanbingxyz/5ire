import { Radio, RadioGroup, type RadioGroupOnChangeData } from "@fluentui/react-components";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/renderer/next/hooks/remote/use-settings";

/**
 * React component that renders appearance settings interface with theme and font size controls.
 * Provides radio button groups for selecting color theme (light, dark, system) and chat font size options.
 * Integrates with settings and appearance stores to persist user preferences.
 *
 * @returns {JSX.Element} The appearance settings component with theme and font size controls
 */
export default function AppearanceSettings() {
  const { t } = useTranslation();

  const settings = useSettings();

  /**
   * Handles theme selection changes from the radio group.
   * Updates both the settings store and applies the theme through electron API.
   * For system theme, retrieves the native theme preference before applying.
   *
   * @param {FormEvent<HTMLDivElement>} ev - The form event from the radio group
   * @param {RadioGroupOnChangeData} data - The radio group change data containing the selected value
   */
  const onThemeChange = (ev: FormEvent<HTMLDivElement>, data: RadioGroupOnChangeData) => {
    // @ts-expect-error
    window.bridge.settingsStore.updateTheme(data.value);
  };

  /**
   * Handles font size selection changes from the radio group.
   * Updates the font size setting in the settings store.
   *
   * @param {FormEvent<HTMLDivElement>} ev - The form event from the radio group
   * @param {RadioGroupOnChangeData} data - The radio group change data containing the selected font size value
   */
  const onFontSizeChange = (ev: FormEvent<HTMLDivElement>, data: RadioGroupOnChangeData) => {
    // @ts-expect-error
    window.bridge.settingsStore.updateFontSize(data.value);
  };

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t("Common.Appearance")}</div>
      <div className="py-4 flex-grow">
        <p className="pt-1 pb-2">{t("Appearance.ColorTheme")}</p>
        <RadioGroup
          name="theme"
          aria-labelledby={t("Common.Appearance")}
          value={settings.theme}
          onChange={onThemeChange}
        >
          <Radio name="appearance" value="light" label={t("Common.Light")} />
          <Radio name="appearance" value="dark" label={t("Common.Dark")} />
          <Radio name="appearance" value="system" label={t("Appearance.System")} />
        </RadioGroup>
      </div>
      <div className="py-4 flex-grow">
        <p className="pt-1 pb-2">{t("Appearance.ChatFontSize")}</p>
        <RadioGroup
          name="fontSize"
          aria-labelledby={t("Common.FontSize")}
          value={settings.fontSize}
          onChange={onFontSizeChange}
        >
          <Radio name="fontSize" value="base" label={t("Common.Normal")} />
          <Radio name="fontSize" value="large" label={t("Common.Large")} />
          <Radio name="fontSize" value="xl" label={t("Common.ExtraLarge")} />
        </RadioGroup>
      </div>
    </div>
  );
}
