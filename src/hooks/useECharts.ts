// @ts-expect-error
import * as echarts from "echarts";
import JSON5 from "json5";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import useAppearanceStore from "stores/useAppearanceStore";

const parseOption = (optStr: string) => {
  try {
    const match = optStr.match(/\{(.+)\}/s);
    if (!match) return {};
    return JSON5.parse(`{${match[1]}}`);
  } catch (error) {
    throw new Error("Invalid ECharts option format");
  }
};

export default function useECharts({ message }: { message: { id: string } }) {
  const { t } = useTranslation();
  const theme = useAppearanceStore((state) => state.theme);
  const messageId = useMemo(() => message.id, [message]);
  const containersRef = useRef<{ [key: string]: echarts.EChartsType }>({});

  const disposeECharts = () => {
    const chartInstances = Object.values(containersRef.current);
    chartInstances.forEach(({ cleanup }: { cleanup: Function }) => {
      cleanup();
    });
    containersRef.current = {};
  };

  const initECharts = (prefix: string, chartId: string) => {
    if (containersRef.current[`${prefix}-${chartId}`]) return; // already initialized
    const chartInstances = containersRef.current;
    const container = document.querySelector(`#${messageId} .echarts-container#${chartId}`) as HTMLDivElement;
    if (!container) return;
    const encodedConfig = container.getAttribute("data-echarts-config");
    if (!encodedConfig) return;
    try {
      const config = decodeURIComponent(encodedConfig);
      const option = parseOption(config);
      const chart = echarts.init(container, theme);
      chart.setOption(option);
      const resizeHandler = () => chart.resize();
      window.addEventListener("resize", resizeHandler);
      chartInstances[`${prefix}-${chartId}`] = {
        chartId,
        instance: chart,
        cleanup: () => {
          window.removeEventListener("resize", resizeHandler);
          chart.dispose();
        },
      };
    } catch (error: any) {
      container.innerHTML = `
        <div class="text-gray-400">
          ${t("Message.Error.EChartsRenderFailed")}
        </div>
      `;
    }
  };

  return {
    disposeECharts,
    initECharts,
  };
}
