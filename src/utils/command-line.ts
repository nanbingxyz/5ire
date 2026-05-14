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

/**
 * Serializes an argv array into a single command-line string that, when fed
 * back through {@link parseCommandLine}, yields the original argv.
 *
 * This is required wherever an argv list (e.g. an MCP stdio server's command +
 * arguments) is collapsed into the single `endpoint` string stored in the
 * database. Naively joining with spaces (`args.join(" ")`) allows an attacker
 * who controls any argument value (for instance via a deep link or marketplace
 * template) to smuggle additional arguments to the spawned process by
 * embedding whitespace, quotes, or backslashes in their value (CWE-78).
 *
 * Each argument is wrapped in double quotes, with embedded backslashes and
 * double quotes escaped, so that {@link parseCommandLine} reconstructs the
 * exact same argv. Empty strings round-trip as `""`.
 */
export function formatCommandLine(args: readonly string[]): string {
  return args
    .map((arg) => {
      const escaped = arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    })
    .join(" ");
}
