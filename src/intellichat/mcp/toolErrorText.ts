const TOOL_ERROR_FALLBACK = "Tool call failed without an error message.";

/**
 * Builds the text sent back to the model when a tool call fails.
 *
 * MCP servers report a failed call as a `CallToolResult` with `isError: true`
 * and the error text in `content`; the main process uses the same shape for its
 * own failures (`{ error, code, ... }` items in `content`). An explicit `error`
 * field is still honoured when present and not blank.
 *
 * Binary blocks (images, audio, embedded blob resources) are replaced by a
 * short placeholder so their base64 data does not end up in the model's text
 * context.
 */
export function getToolErrorText(toolResult: any): string {
  const explicitError = toolResult?.error;
  if (typeof explicitError === "string") {
    if (explicitError.trim().length > 0) {
      return explicitError;
    }
  } else if (explicitError !== undefined && explicitError !== null) {
    return JSON.stringify(explicitError);
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
      if (block?.type === "image" || block?.type === "audio") {
        return `[${block.type} content${block.mimeType ? ` (${block.mimeType})` : ""} omitted]`;
      }
      if (block?.type === "resource" && block.resource && typeof block.resource.blob === "string") {
        const { blob: _blob, ...resource } = block.resource;
        return JSON.stringify({ ...block, resource });
      }
      return JSON.stringify(block);
    })
    .filter((text: string | undefined) => typeof text === "string" && text.trim().length > 0);

  return parts.length > 0 ? parts.join("\n") : TOOL_ERROR_FALLBACK;
}
