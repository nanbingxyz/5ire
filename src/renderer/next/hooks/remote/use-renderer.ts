import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const store = createStateStreamStore({
  streamLoader: window.bridge.renderer.createStateStream,
});

export const useRenderer = () => useStore(suspend(() => store, ["renderer"]));
