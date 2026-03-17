export function parseCommandLine(input: string): string[] {
  if (!input.trim()) {
    return [];
  }

  const tokens: string[] = [];

  let current = "";
  let quote: '"' | "'" | null = null;
  let tokenStarted = false;

  const pushToken = () => {
    if (!tokenStarted) {
      return;
    }

    tokens.push(current);
    current = "";
    tokenStarted = false;
  };

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "\\") {
      if (quote === "'") {
        current += char;
        tokenStarted = true;
        continue;
      }

      if (quote === '"') {
        if (next === "\\" || next === '"') {
          current += next;
          tokenStarted = true;
          index++;
          continue;
        }

        current += char;
        tokenStarted = true;
        continue;
      }

      if (next === "\\" || next === '"' || next === "'" || (next && /\s/.test(next))) {
        current += next;
        tokenStarted = true;
        index++;
        continue;
      }

      current += char;
      tokenStarted = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
        tokenStarted = true;
        continue;
      }

      current += char;
      tokenStarted = true;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(char)) {
      pushToken();
      continue;
    }

    current += char;
    tokenStarted = true;
  }

  if (quote) {
    // Fall back to simple splitting when quotes are unmatched.
    return input.trim().split(/\s+/).filter(Boolean);
  }

  pushToken();

  return tokens;
}
