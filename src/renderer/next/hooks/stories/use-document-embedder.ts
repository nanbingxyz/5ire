import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

const store = createStreamStore({
  streamLoader: window.bridge.documentEmbedder.createStateStream,
});

export const useDocumentEmbedder = () => useStore(suspend(() => store, ["document-embedder"]));
