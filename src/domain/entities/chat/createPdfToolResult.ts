/**
 * ``create_pdf`` tool result contract — spec ``chat-pdf-attachments``
 * (REQ-058, REQ-077, EDG-011).
 *
 * The frontend renders Preview/Download actions ONLY for a strictly valid
 * result: tool name ``create_pdf`` + JSON object with a path under
 * ``/documents/``. Anything else keeps the generic tool rendering
 * (REQ-091 / EC-010).
 */
import { z } from "zod";

/** A valid PDF tool result path is always scoped under /documents/<thread_id>/… */
const createPdfToolResultSchema = z.object({
  path: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("/documents/"), {
      message: "path must live under /documents/",
    }),
  filename: z.string().min(1),
  mime_type: z.string().min(1),
});

export interface CreatePdfToolResult {
  path: string;
  filename: string;
  mime_type: string;
}

/** Parse a ``TOOL_RESULT`` payload. Returns null unless it is a valid create_pdf result. */
export function parseCreatePdfToolResult(
  name: string | null,
  content: string | null,
): CreatePdfToolResult | null {
  if (name !== "create_pdf" || !content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return null;
  }
  const result = createPdfToolResultSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
