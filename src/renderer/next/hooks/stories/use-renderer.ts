import { suspend } from "suspend-react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const store = window.bridge.renderer.createStateStream().then(async (reader) => {
  const initial = await reader.next();

  if (initial.done) {
    throw new Error("Initial state is empty");
  }

  const instance = createStore(() => {
    return initial.value;
  });

  Promise.resolve()
    .then(async () => {
      while (true) {
        const chunk = await reader.next();

        if (chunk.done) {
          break;
        }

        instance.setState(() => chunk.value, true);
      }
    })
    .catch(() => {
      //
    });

  return instance;
});

export const useRenderer = () => useStore(suspend(() => store, ["renderer"]));
