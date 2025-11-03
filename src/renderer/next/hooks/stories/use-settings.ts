import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStreamStore } from "@/renderer/next/hooks/stories/utils";

const store = createStreamStore({
  streamLoader: window.bridge.settingsStore.createStateStream,
});

export const useSettings = () => useStore(suspend(() => store, ["settings"]));
