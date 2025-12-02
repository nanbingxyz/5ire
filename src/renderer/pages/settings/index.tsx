import { useTranslation } from "react-i18next";

import "./Settings.scss";

import usePlatform from "hooks/usePlatform";
import { Link } from "react-router-dom";
import AppearanceSettings from "./AppearanceSettings";
import EmbedSettings from "./EmbedSettings";
import LanguageSettings from "./LanguageSettings";
import Version from "./Version";

export default function Settings() {
  const { isDarwin } = usePlatform();
  const { t } = useTranslation();

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl">{t("Common.Settings")}</h1>
        </div>
      </div>
      <div className={`overflow-y-auto h-full  -mr-5 pr-5 ${isDarwin ? "pb-28" : "pb-16"}`}>
        <div className="settings-section">
          <div className="settings-section--header">{t("Common.API")}</div>
          <div className="py-4 flex-grow mt-1 gap-1">
            <span className="tips">{t("Settings.ProviderSettingsMovedTo")}&nbsp;</span>
            <Link to="/providers" className="underline">
              {t("Common.Providers")}
            </Link>
          </div>
        </div>
        <EmbedSettings />
        <AppearanceSettings />
        <LanguageSettings />
        <Version />
      </div>
    </div>
  );
}
