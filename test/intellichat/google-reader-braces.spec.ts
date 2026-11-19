import { describe, expect, test } from "@jest/globals";
import GoogleReader from "../../src/intellichat/readers/GoogleReader";
import { extractFirstLevelBrackets } from "../../src/utils/util";

class MockReader {
  private data: { value: Uint8Array; done: boolean }[] = [];
  private cursor = 0;
  constructor(chunks: string[]) {
    const encode = new TextEncoder();
    chunks.forEach((c, i) => {
      this.data.push({ value: encode.encode(c), done: i === chunks.length - 1 });
    });
  }
  public async read() {
    return this.data[this.cursor++];
  }
}

const item = (text: string) =>
  JSON.stringify(
    {
      candidates: [{ content: { parts: [{ text }], role: "model" }, index: 0 }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    },
    null,
    2,
  );

// Gemini streams a JSON array, one object per event.
const stream = (texts: string[]) => {
  const out = texts.map((t, i) => (i === 0 ? "[" : ",") + item(t));
  out.push("]");
  return out;
};

async function run(chunks: string[]) {
  const reader = new GoogleReader(new MockReader(chunks) as unknown as ReadableStreamDefaultReader<Uint8Array>);
  return reader.read({
    onProgress: () => {},
    onError: () => {},
    onToolCalls: () => {},
  });
}

describe("extractFirstLevelBrackets", () => {
  test("ignores braces inside JSON strings", () => {
    const obj = JSON.stringify({ a: "x } y", b: "{", c: 'q"}\\' });
    expect(extractFirstLevelBrackets(`[${obj},${obj}]`)).toEqual([obj, obj]);
  });
});

describe("GoogleReader with braces in text", () => {
  test.each([
    [["}"]],
    [["{"]],
    [["function f() {", "  return 1;\n}"]],
    [["a } b"]],
    [["ok ", "} tail", " more"]],
    [['say "}" \\ {', " end"]],
  ])("keeps all content for %j", async (texts) => {
    const result = await run(stream(texts as string[]));
    expect(result.content).toEqual((texts as string[]).join(""));
  });

  test("keeps an event that is split across network chunks", async () => {
    const whole = stream(["Hello", " world"]).join("");
    const cut = whole.indexOf("world") + 20;
    const result = await run([whole.slice(0, cut), whole.slice(cut)]);
    expect(result.content).toEqual("Hello world");
    expect(result.outputTokens).toEqual(2);
  });
});
