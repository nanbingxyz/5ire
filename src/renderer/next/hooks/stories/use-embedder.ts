import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

const store = createStreamStore({
  streamLoader: window.bridge.embedder.createStateStream,
});

export const useEmbedder = () => useStore(suspend(() => store, ["embedder"]));
