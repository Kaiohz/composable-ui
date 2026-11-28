/**
 * Display helpers for MCP tool payloads (tool-call args + tool results).
 *
 * Trace events carry tool payloads as JSON strings, often double-wrapped:
 * the MCP content envelope `[{"type":"text","text":"{...}"}]` where the text
 * of each block is ITSELF a JSON string (e.g. the web_search response). The
 * raw dump renders as escaped-JSON soup; these helpers unwrap the envelope
 * and pretty-print the payload so the mono block reads as structured data.
 */

/** Parsed JSON or `null` when the input is not a strict JSON document. */
function tryJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * Unwrap an MCP content envelope: an array (or single object) of
 * `{type: "text", text: string}` blocks becomes the joined text blocks;
 * `null` when the value is not such an envelope.
 */
function unwrapContentBlocks(value: unknown): string[] | null {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    const blocks = value.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (item as { type?: unknown; text?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string",
    );
    if (blocks) {
      return value.map((item) => (item as { text: string }).text);
    }
  }
  if (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "text" &&
    typeof (value as { text?: unknown }).text === "string"
  ) {
    return [(value as { text: string }).text];
  }
  return null;
}

/**
 * Render a single JSON-or-text payload for display: JSON pretty-printed with
 * an indent of 2, non-JSON text verbatim. Nested JSON strings inside the top
 * level are expanded at most one additional level (the MCP envelope case).
 */
export function prettyToolText(raw: string): string {
  const outer = tryJson(raw);
  if (outer === null) {
    return raw;
  }
  const innerValues = unwrapContentBlocks(outer);
  if (innerValues === null) {
    return JSON.stringify(outer, null, 2);
  }
  return innerValues
    .map((text) => {
      const inner = tryJson(text);
      return inner === null ? text : JSON.stringify(inner, null, 2);
    })
    .join("\n\n");
}

/**
 * Render a full tool RESULT content string (a serialized MCP content array)
 * for the mono detail block. Falls back to {@link prettyToolText} semantics
 * for anything that is not an envelope.
 */
export function toolResultDisplayText(content: string): string {
  return prettyToolText(content);
}

/**
 * Render the ARGUMENTS of a tool call (a JSON-object string) for the mono
 * detail block: pretty-printed JSON, or the raw text verbatim when it is not
 * JSON.
 */
export function toolArgsDisplayText(args: string): string {
  return prettyToolText(args);
}
