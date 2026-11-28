// Built-in providers that changed their name. Saved settings and chats keep the
// old name, so it is mapped to the current one wherever a provider is looked up.
export const RENAMED_PROVIDERS: Record<string, string> = {
  UberLLM: "MartLLM",
};

export function currentProviderName(name: string): string {
  return RENAMED_PROVIDERS[name] || name;
}

// Gives a saved provider its new name, unless a provider with the new name is
// already saved (then the saved one under the new name wins).
export function renameSavedProviders<T extends { name: string }>(saved: T[]): T[] {
  const names = new Set(saved.map((p) => p.name));
  return saved.map((p) => {
    const name = RENAMED_PROVIDERS[p.name];
    return name && !names.has(name) ? { ...p, name } : p;
  });
}
