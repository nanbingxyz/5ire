import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.mcpServersManager.liveServers,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useServers = () => {
  return useStore(suspend(createStore, [key]));
};

export const useServersWithSelector = <T>(selector: (raw: ReturnType<typeof useServers>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};
