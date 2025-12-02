import { Radio, RadioGroup, type RadioGroupOnChangeData } from "@fluentui/react-components";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/renderer/next/hooks/remote/use-settings";

export default function LanguageSettings() {
  const { t } = useTranslation();

  const settings = useSettings();

  const onLanguageChange = (ev: FormEvent<HTMLDivElement>, data: RadioGroupOnChangeData) => {
    // @ts-expect-error
    window.bridge.settingsStore.updateLanguage(data.value);
  };

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t("Common.Language")}</div>
      <div className="py-4 flex-grow">
        <RadioGroup aria-labelledby={t("Common.Language")} value={settings.language} onChange={onLanguageChange}>
          <Radio name="language" value="en" label={t("Common.English")} />
          <Radio name="language" value="zh-CN" label={t("Common.SimpleChinese")} />
          <Radio name="language" value="system" label={t("Appearance.System")} />
        </RadioGroup>
      </div>
    </div>
  );
}
