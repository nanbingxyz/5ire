import { useRef } from "react";
import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

const createStore = async (project?: string) => {
  return createStateStreamStore({
    streamLoader: () => {
      return window.bridge.conversationsManager.liveConversations({ project });
    },
    onDone: () => {
      clear([key, project || "global"]);
    },
  }).then(({ instance }) => {
    return instance;
  });
};

export const useLiveConversations = (project?: string) => {
  return useStore(suspend(() => createStore(project), [key, project || "global"]));
};

export const useLiveConversationsWithSelector = <T>(
  project: string | undefined,
  selector: (raw: ReturnType<typeof useLiveConversations>) => T,
) => {
  return useStore(
    suspend(() => createStore(project), [key, project || "global"]),
    selector,
  );
};

export const useLiveTurnsRef = (project?: string) => {
  return useRef(suspend(() => createStore(project), [key, project || "global"]));
};
