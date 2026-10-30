import { describe, expect, test } from "@jest/globals";
import { getToolErrorText } from "../../src/intellichat/mcp/toolErrorText";

describe("intellichat/mcp/toolErrorText", () => {
  test("uses the text content of an MCP CallToolResult with isError", () => {
    expect(
      getToolErrorText({
        isError: true,
        content: [
          { type: "text", text: "file already exists" },
          { type: "text", text: "path: /tmp/a.txt" },
        ],
      }),
    ).toBe("file already exists\npath: /tmp/a.txt");
  });

  test("uses the error message of internal failure results", () => {
    expect(
      getToolErrorText({
        isError: true,
        content: [
          {
            error: "MCP Client fs not found",
            code: "client_not_found",
            clientName: "fs",
            toolName: "write_file",
          },
        ],
      }),
    ).toBe("MCP Client fs not found");
  });

  test("prefers an explicit error field when present", () => {
    expect(getToolErrorText({ isError: true, error: "boom", content: [] })).toBe("boom");
    expect(getToolErrorText({ isError: true, error: { code: 1 } })).toBe('{"code":1}');
  });

  test("uses content when the explicit error is blank", () => {
    expect(getToolErrorText({ isError: true, error: "", content: [{ type: "text", text: "disk full" }] })).toBe(
      "disk full",
    );
    expect(getToolErrorText({ isError: true, error: "   " }).trim().length).toBeGreaterThan(0);
  });

  test("does not put binary data into the error text", () => {
    const data = "A".repeat(10000);
    const text = getToolErrorText({
      isError: true,
      content: [
        { type: "text", text: "screenshot failed" },
        { type: "image", data, mimeType: "image/png" },
        { type: "audio", data, mimeType: "audio/wav" },
        { type: "resource", resource: { uri: "file:///tmp/a.bin", mimeType: "application/octet-stream", blob: data } },
      ],
    });
    expect(text).not.toContain(data);
    expect(text).toBe(
      [
        "screenshot failed",
        "[image content (image/png) omitted]",
        "[audio content (audio/wav) omitted]",
        '{"type":"resource","resource":{"uri":"file:///tmp/a.bin","mimeType":"application/octet-stream"}}',
      ].join("\n"),
    );
  });

  test("serializes non-text blocks instead of dropping them", () => {
    expect(
      getToolErrorText({
        isError: true,
        content: [{ type: "resource_link", uri: "file:///tmp/a.txt", name: "a" }],
      }),
    ).toBe('{"type":"resource_link","uri":"file:///tmp/a.txt","name":"a"}');
  });

  test("falls back to a non-empty message when there is nothing to report", () => {
    expect(getToolErrorText({ isError: true }).trim().length).toBeGreaterThan(0);
    expect(getToolErrorText({ isError: true, content: [{ type: "text", text: "" }] }).trim().length).toBeGreaterThan(0);
  });
});
