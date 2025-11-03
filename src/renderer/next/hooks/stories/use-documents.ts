import { useEffect, useRef } from "react";
import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

export const useDocuments = (collectionId: string) => {
  const controller = useRef(new AbortController());

  useEffect(() => {
    return () => {
      controller.current.abort();
    };
  }, []);

  return useStore(
    suspend(() => {
      return createStreamStore({
        streamLoader: () => window.bridge.documentManager.liveDocuments(collectionId),
        signal: controller.current.signal,
      });
    }, ["documents", collectionId]),
  );
};
