import { currentProviderName, renameSavedProviders } from "../../src/providers/renamed";

describe("renamed providers", () => {
  test("maps the old UberLLM name to MartLLM", () => {
    expect(currentProviderName("UberLLM")).toBe("MartLLM");
    expect(currentProviderName("OpenAI")).toBe("OpenAI");
  });

  test("a saved UberLLM provider keeps its key under the new name", () => {
    const saved = [
      { name: "UberLLM", apiKey: "k1", models: [] },
      { name: "OpenAI", apiKey: "k2", models: [] },
    ];
    expect(renameSavedProviders(saved)).toEqual([
      { name: "MartLLM", apiKey: "k1", models: [] },
      { name: "OpenAI", apiKey: "k2", models: [] },
    ]);
  });

  test("an already saved MartLLM provider is not overwritten", () => {
    const saved = [
      { name: "UberLLM", apiKey: "old" },
      { name: "MartLLM", apiKey: "new" },
    ];
    expect(renameSavedProviders(saved)).toEqual(saved);
  });
});
