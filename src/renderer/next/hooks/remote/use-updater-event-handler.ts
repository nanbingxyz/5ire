import { useEffect, useRef } from "react";
import type { Emitter } from "@/main/internal/emitter";
import type { Updater } from "@/main/services/updater";

type EventHandler = (event: Emitter.WildcardEventChunk<Updater.Events>) => void;

export const useUpdaterEventHandler = (handler: EventHandler) => {
  const controller = useRef(new AbortController());
  const fn = useRef(handler);

  useEffect(() => {
    fn.current = handler;
  }, [handler]);

  useEffect(() => {
    window.bridge.updater.createEventStream().then(async (stream) => {
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
