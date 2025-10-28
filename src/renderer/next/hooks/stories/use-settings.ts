import { applyPatches, enablePatches } from "immer";
import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

enablePatches();

const store = window.bridge.settingsStore.stream().then(async (reader) => {
  const initial = await reader.next();

  if (initial.done) {
    throw new Error("Initial state is empty");
  }

  const instance = createStore(() => {
    return initial.value[0];
  });

  Promise.resolve()
    .then(async () => {
      while (true) {
        const chunk = await reader.next();

        if (chunk.done) {
          break;
        }

        const [state, patches] = chunk.value;

        instance.setState((prev) => {
          return patches ? applyPatches(prev, patches.forward) : state;
        });
      }
    })
    .catch(() => {
      //
    });

  return instance;
});

export const useSettings = () => useStore(suspend(() => store, []));
