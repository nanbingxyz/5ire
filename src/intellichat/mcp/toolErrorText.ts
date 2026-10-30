const TOOL_ERROR_FALLBACK = "Tool call failed without an error message.";

/**
 * Builds the text sent back to the model when a tool call fails.
 *
 * MCP servers report a failed call as a `CallToolResult` with `isError: true`
 * and the error text in `content`; the main process uses the same shape for its
 * own failures (`{ error, code, ... }` items in `content`). An explicit `error`
 * field is still honoured when present.
 */
export function getToolErrorText(toolResult: any): string {
  if (toolResult?.error !== undefined && toolResult.error !== null) {
    return typeof toolResult.error === "string" ? toolResult.error : JSON.stringify(toolResult.error);
  }

  const content = toolResult?.content;
  const blocks = Array.isArray(content) ? content : content !== undefined && content !== null ? [content] : [];

  const parts = blocks
    .map((block: any) => {
      if (typeof block === "string") {
        return block;
      }
      if (block?.type === "text" && typeof block.text === "string") {
        return block.text;
      }
      if (typeof block?.error === "string") {
        return block.error;
      }
      return JSON.stringify(block);
    })
    .filter((text: string | undefined) => typeof text === "string" && text.trim().length > 0);

  return parts.length > 0 ? parts.join("\n") : TOOL_ERROR_FALLBACK;
}
