import { useRef } from "react";
import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async (id: string) => {
  return createStateStreamStore({
    streamLoader: () => {
      return window.bridge.conversationsManager.liveTurns({ id });
    },
    onDone: () => {
      clear([key, id]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useLiveTurns = (id: string) => {
  return useStore(suspend(() => createStore(id), [key, id]));
};

export const useLiveTurnsWithSelector = <T>(id: string, selector: (raw: ReturnType<typeof useLiveTurns>) => T) => {
  return useStore(
    suspend(() => createStore(id), [key]),
    selector,
  );
};

export const useLiveTurnsRef = (id: string) => {
  return useRef(suspend(() => createStore(id), [key]));
};
