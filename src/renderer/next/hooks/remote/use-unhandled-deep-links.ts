import { clear, preload, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.deepLinkHandler.createUnhandledDeepLinksStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

preload(createStore, [key]);

export const useUnhandledDeepLinks = () => {
  return useStore(suspend(createStore, [key]));
};

export const useUnhandledDeepLinksWithSelector = <T>(
  selector: (raw: ReturnType<typeof useUnhandledDeepLinks>) => T,
) => {
  return useStore(suspend(createStore, [key]), selector);
};
