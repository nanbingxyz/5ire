import { useEffect, useRef } from "react";
import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

export const useLiveDocuments = (collectionId: string) => {
  const controller = useRef(new AbortController());

  useEffect(() => {
    return () => {
      controller.current.abort();
    };
  }, []);

  return useStore(
    suspend(() => {
      return createStateStreamStore({
        streamLoader: () => window.bridge.documentManager.liveDocuments(collectionId),
        signal: controller.current.signal,
      });
    }, ["documents", collectionId]),
  );
};
