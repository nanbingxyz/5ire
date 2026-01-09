import { useRef } from "react";
import { clear, preload, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.providersManager.createStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

preload(createStore, [key]);

export const useLiveProviders = () => {
  return useStore(suspend(createStore, [key]));
};

export const useLiveProvidersWithSelector = <T>(selector: (raw: ReturnType<typeof useLiveProviders>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};

export const useLiveProvidersRef = () => {
  return useRef(suspend(createStore, [key]));
};
