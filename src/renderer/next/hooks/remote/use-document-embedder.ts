import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const store = createStateStreamStore({
  streamLoader: window.bridge.documentEmbedder.createStateStream,
});

export const useDocumentEmbedder = () => useStore(suspend(() => store, ["document-embedder"]));
