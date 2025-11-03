import { useEffect, useRef } from "react";
import type { Emitter } from "@/main/internal/emitter";
import type { DocumentEmbedder } from "@/main/services/document-embedder";

type EventHandler = (event: Emitter.WildcardEventChunk<DocumentEmbedder.Events>) => void;

export const useDocumentEmbedderEventHandler = (handler: EventHandler) => {
  const controller = useRef(new AbortController());
  const fn = useRef(handler);

  useEffect(() => {
    fn.current = handler;
  }, [handler]);

  useEffect(() => {
    window.bridge.documentEmbedder.createEventStream().then(async (stream) => {
      while (true) {
        const chunk = await stream.next();

        if (chunk.done) {
          break;
        }

        fn.current(chunk.value);
      }
    });

    return () => {
      controller.current.abort();
    };
  }, []);
};
