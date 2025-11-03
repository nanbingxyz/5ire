import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

const store = createStreamStore({
  streamLoader: window.bridge.updater.createStateStream,
});

export const useUpdater = () => useStore(suspend(() => store, ["updater"]));
