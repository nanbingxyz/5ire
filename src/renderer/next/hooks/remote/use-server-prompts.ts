import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.mcpConnectionsManager.prompt.createStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useServerPrompts = () => {
  return useStore(suspend(createStore, [key]));
};

export const useServerPromptsWithSelector = <T>(selector: (raw: ReturnType<typeof useServerPrompts>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};
