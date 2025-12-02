/// <reference types="@rsbuild/core/types" />

type Bridge = import("./main/preload").ExposedBridge;

declare global {
  interface Window {
    bridge: Bridge;
  }
}

export {};
