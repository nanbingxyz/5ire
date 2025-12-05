import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.mcpConnectionsManager.createStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useServerConnections = () => {
  return useStore(suspend(createStore, [key]));
};

export const useServerConnectionsWithSelector = <T>(selector: (raw: ReturnType<typeof useServerConnections>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};
