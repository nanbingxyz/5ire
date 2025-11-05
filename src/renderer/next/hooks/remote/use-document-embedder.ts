import { clear, preload, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async () => {
  return createStateStreamStore({
    streamLoader: window.bridge.documentEmbedder.createStateStream,
    onDone: () => {
      clear([key]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

preload(createStore, [key]);

export const useDocumentEmbedder = () => {
  return useStore(suspend(createStore, [key]));
};
