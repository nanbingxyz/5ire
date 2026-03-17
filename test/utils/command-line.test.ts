import { describe, expect, test } from "@jest/globals";
import { parseCommandLine } from "../../src/utils/command-line";

describe("utils/command-line", () => {
  test("splits plain command by whitespace", () => {
    expect(parseCommandLine("npx -y @modelcontextprotocol/server")).toEqual([
      "npx",
      "-y",
      "@modelcontextprotocol/server",
    ]);
  });

  test("keeps double-quoted path as one argument", () => {
    expect(parseCommandLine('python "C:\\path with spaces\\script.py"')).toEqual([
      "python",
      "C:\\path with spaces\\script.py",
    ]);
  });

  test("keeps single-quoted path as one argument", () => {
    expect(parseCommandLine("python 'C:\\path with spaces\\script.py' --flag")).toEqual([
      "python",
      "C:\\path with spaces\\script.py",
      "--flag",
    ]);
  });

  test("still splits unquoted path with spaces", () => {
    expect(parseCommandLine("python C:\\path with spaces\\script.py")).toEqual([
      "python",
      "C:\\path",
      "with",
      "spaces\\script.py",
    ]);
  });
});
