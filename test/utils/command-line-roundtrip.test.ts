import { describe, expect, test } from "@jest/globals";
import { formatCommandLine, parseCommandLine } from "../../src/utils/command-line";

describe("utils/command-line round-trip (argv smuggling protection)", () => {
  const cases: Array<[string, string[]]> = [
    ["plain", ["npx", "-y", "@modelcontextprotocol/server"]],
    ["arg with space", ["python", "C:\\path with spaces\\script.py", "--flag"]],
    ["arg with double quote", ["echo", 'hello "world"']],
    ["arg with single quote", ["echo", "it's"]],
    ["arg with backslash", ["python", "C:\\foo\\bar"]],
    [
      "argv smuggling attempt: extra args injected via space",
      ["mcp-server", "--config=safe", "--inject extra-arg --bad"],
    ],
    [
      "argv smuggling attempt: shell metacharacters",
      ["mcp-server", "; rm -rf ~", "$(whoami)", "`id`", "&& touch /tmp/pwned"],
    ],
  ];

  for (const [name, args] of cases) {
    test(`round-trips: ${name}`, () => {
      const serialized = formatCommandLine(args);
      expect(parseCommandLine(serialized)).toEqual(args);
    });
  }
});
