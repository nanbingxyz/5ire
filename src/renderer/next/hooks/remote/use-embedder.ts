import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const store = createStateStreamStore({
  streamLoader: window.bridge.embedder.createStateStream,
});

export const useEmbedder = () => useStore(suspend(() => store, ["embedder"]));
