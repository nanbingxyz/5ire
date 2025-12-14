import { useRef } from "react";
import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.promptsManager.livePrompts,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useLivePrompts = () => {
  return useStore(suspend(createStore, [key]));
};

export const useLivePromptsWithSelector = <T>(selector: (raw: ReturnType<typeof useLivePrompts>) => T) => {
  return useStore(suspend(createStore, [key]), selector);
};

export const useLivePromptsRef = () => {
  return useRef(suspend(createStore, [key]));
};
