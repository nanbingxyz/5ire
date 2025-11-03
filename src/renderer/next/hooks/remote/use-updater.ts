import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const store = createStateStreamStore({
  streamLoader: window.bridge.updater.createStateStream,
});

export const useUpdater = () => useStore(suspend(() => store, ["updater"]));
