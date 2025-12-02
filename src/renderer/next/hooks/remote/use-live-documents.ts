import { clear, suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const key = crypto.randomUUID();

// TODO: Need to manually close unused LiveDocuments to avoid memory pressure from excessive subscriptions
export const useLiveDocuments = (collectionId: string) => {
  const store = suspend(async () => {
    const keys = [key, collectionId];
    return createStateStreamStore({
      streamLoader: () => window.bridge.documentManager.liveDocuments(collectionId),
      onDone: () => {
        clear(keys);
      },
    }).then(({ instance }) => {
      return instance;
    });
  }, [key, collectionId]);

  return useStore(store);
};
