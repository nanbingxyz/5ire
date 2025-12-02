import { useEffect, useRef } from "react";
import type { Emitter } from "@/main/internal/emitter";
import type { Embedder } from "@/main/services/embedder";

type EventHandler = (event: Emitter.WildcardEventChunk<Embedder.Events>) => void;

export const useEmbedderEventHandler = (handler: EventHandler) => {
  const controller = useRef(new AbortController());
  const fn = useRef(handler);

  useEffect(() => {
    fn.current = handler;
  }, [handler]);

  useEffect(() => {
    window.bridge.embedder.createEventStream().then(async (stream) => {
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
