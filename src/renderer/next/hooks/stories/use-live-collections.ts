import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

const store = createStreamStore({
  streamLoader: window.bridge.documentManager.liveCollections,
});

export const useLiveCollections = () => useStore(suspend(() => store, ["live/collections"]));
