import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.mcpConnectionsManager.tool.createStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useServerTools = () => {
  return useStore(suspend(createStore, [key]));
};

export const useServerToolsWithSelector = <T>(selector: (raw: ReturnType<typeof useServerTools>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};
