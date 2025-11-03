import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStateStreamStore } from "@/renderer/next/hooks/remote/utils";

const store = createStateStreamStore({
  streamLoader: window.bridge.documentManager.liveCollections,
});

export const useDocumentCollections = () => useStore(suspend(() => store, ["document/collections"]));
