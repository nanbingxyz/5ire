import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.mcpConnectionsManager.resource.createStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useServerResources = () => {
  return useStore(suspend(createStore, [key]));
};

export const useServerResourcesWithSelector = <T>(selector: (raw: ReturnType<typeof useServerResources>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};
