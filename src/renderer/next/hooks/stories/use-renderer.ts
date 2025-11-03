import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

const store = createStreamStore({
  streamLoader: window.bridge.renderer.createStateStream,
});

export const useRenderer = () => useStore(suspend(() => store, ["renderer"]));
