import type { ProviderKind } from "@/main/database/types";

export const getBuiltinProviderLabel = (kind: Exclude<ProviderKind, "openai-compatible">) => {
  let label: string;

  if (kind === "302-ai") {
    label = "302.AI";
  } else if (kind === "lm-studio") {
    label = "LM Studio";
  } else if (kind === "baidu") {
    label = "Bai Du";
  } else if (kind === "zhipu") {
    label = "Zhi Pu";
  } else if (kind === "deepseek") {
    label = "DeepSeek";
  } else if (kind === "doubao") {
    label = "Dou Bao";
  } else {
    label = kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  return label;
};
