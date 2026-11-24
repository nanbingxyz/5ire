import { describe, expect, test } from "@jest/globals";
import GoogleReader from "../../src/intellichat/readers/GoogleReader";
import OllamaReader from "../../src/intellichat/readers/OllamaChatReader";
import OpenAIReader from "../../src/intellichat/readers/OpenAIReader";

class MockReader {
  private cursor = 0;
  constructor(private chunks: Uint8Array[]) {}
  public async read() {
    if (this.cursor >= this.chunks.length) {
      return { value: undefined, done: true };
    }
    return { value: this.chunks[this.cursor++], done: false };
  }
}

const enc = new TextEncoder();
const callbacks = {
  onProgress: () => {},
  onError: () => {},
  onToolCalls: () => {},
};
const asStream = (chunks: Uint8Array[]) => new MockReader(chunks) as unknown as ReadableStreamDefaultReader<Uint8Array>;

// Cut the bytes in the middle of the first multi-byte character.
const cutInsideChar = (bytes: Uint8Array) => {
  const lead = bytes.findIndex((b) => b >= 0xc0);
  return [bytes.slice(0, lead + 1), bytes.slice(lead + 1)];
};

describe("multi-byte characters split across network reads", () => {
  test("OpenAIReader keeps a CJK character cut in the middle", async () => {
    const body = enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "你好世界" } }] })}\n\n`);
    const done = enc.encode("data: [DONE]\n\n");
    const result = await new OpenAIReader(asStream([...cutInsideChar(body), done])).read(callbacks);
    expect(result.content).toEqual("你好世界");
  });

  test("OllamaReader keeps an emoji cut in the middle", async () => {
    const body = enc.encode(`${JSON.stringify({ message: { content: "ok,😀 done" }, done: false })}\n`);
    const end = enc.encode(`${JSON.stringify({ message: { content: "" }, done: true })}\n`);
    const result = await new OllamaReader(asStream([...cutInsideChar(body), end])).read(callbacks);
    expect(result.content).toEqual("ok,😀 done");
  });

  test("GoogleReader keeps a CJK character cut in the middle", async () => {
    const body = enc.encode(
      `[${JSON.stringify({
        candidates: [{ content: { parts: [{ text: "你好世界" }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      })}]`,
    );
    const result = await new GoogleReader(asStream(cutInsideChar(body))).read(callbacks);
    expect(result.content).toEqual("你好世界");
  });
});
