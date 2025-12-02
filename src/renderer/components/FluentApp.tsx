import {
  type BrandVariants,
  createDarkTheme,
  createLightTheme,
  FluentProvider,
  type Theme,
  Toaster,
} from "@fluentui/react-components";
import Debug from "debug";
import usePlatform from "hooks/usePlatform";
import useUI from "hooks/useUI";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MemoryRouter as Router } from "react-router-dom";
import { Routes } from "@/renderer/next/components/routes";
import { useRenderer } from "@/renderer/next/hooks/remote/use-renderer";
import { useSettings } from "@/renderer/next/hooks/remote/use-settings";
import AppHeader from "./layout/AppHeader";
import AppSidebar from "./layout/aside/AppSidebar";
import WindowsTitleBar from "./layout/WindowsTitleBar";
import ToolSetup from "./ToolSetup";

const fire: BrandVariants = {
  10: "#030303",
  20: "#171717",
  30: "#252525",
  40: "#313131",
  50: "#3D3D3D",
  60: "#494949",
  70: "#565656",
  80: "#636363",
  90: "#717171",
  100: "#7F7F7F",
  110: "#8D8D8D",
  120: "#9B9B9B",
  130: "#AAAAAA",
  140: "#B9B9B9",
  150: "#C8C8C8",
  160: "#D7D7D7",
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

  const renderer = useRenderer();
  const settings = useSettings();

  const theme = useMemo(() => {
    if (settings.theme === "system") {
      return renderer.shouldUseDarkColors ? "dark" : "light";
    }

    return settings.theme;
  }, [renderer.shouldUseDarkColors, settings.theme]);

  const language = useMemo(() => {
    if (settings.language === "system") {
      return renderer.locale;
    }

    return settings.language;
  }, [settings.language, renderer.locale]);

  const fontSizeCls = useMemo(() => {
    switch (settings.fontSize) {
      case "large":
        return "font-lg";
      case "xl":
        return "font-xl";
      default:
        return "font-base"; // default
    }
  }, [settings.fontSize]);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    window.bridge.renderer.show().catch(() => {});
  }, []);

  return (
    <FluentProvider
      theme={theme === "light" ? lightTheme : darkTheme}
      data-theme={theme}
      style={{ background: "transparent" }}
    >
      <div className={`flex flex-col h-screen ${isDarwin ? "" : "bg-sidebar"}`}>
        <div className="flex-1">
          <Router>
            {isDarwin ? <AppHeader /> : <WindowsTitleBar />}

            <Toaster toasterId="toaster" limit={5} offset={{ vertical: 25 }} />
            <div
              className={`relative flex  w-full overflow-hidden main-container ${fontSizeCls}`}
              style={{
                height: heightStyle(),
              }}
            >
              <AppSidebar />
              <main
                className={`relative px-5 flex h-full w-full flex-col overflow-hidden  ${isDarwin ? "darwin" : "border-l border-t border-base rounded-tl-lg"}`}
              >
                <Routes />
                <div id="portal" style={{ zIndex: 9999999, position: "absolute" }} />
              </main>
            </div>
            <ToolSetup />
          </Router>
        </div>
      </div>
    </FluentProvider>
  );
}
