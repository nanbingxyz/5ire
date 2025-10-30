import { useEffect } from "react";

export const EmbedderEventsHandler = () => {
  useEffect(() => {
    const abortController = new AbortController();

    window.bridge.embedder.createEventStream().then(async (reader) => {
      if (abortController.signal.aborted) {
        return reader.stop().catch(() => {});
      }

      abortController.signal.addEventListener("abort", () => {
        reader.stop().catch(() => {});
      });

      while (true) {
        try {
          const chunk = await reader.next();

          if (chunk.done) {
            break;
          }

          switch (chunk.value.event) {
            case "model-download-failed":
              console.log(chunk.value.payload.message);
          }
        } catch (e) {
          return reader.stop().catch(() => {});
        }
      }
    });

    return () => {
      abortController.abort();
    };
  }, []);

  return null;
};
