/**
 * Chat attachment entities — spec ``chat-pdf-attachments`` (§5.6, §9.5).
 *
 * Two distinct contracts:
 *  - {@link ChatAttachmentPayload}: what the FRONTEND sends in the
 *    ``ChatRequest.attachments`` field (filename / MIME / base64 content,
 *    REQ-001). The frontend never uploads to RustFS itself (REQ-066): the
 *    base64 travels inside the chat payload and the backend takes care of
 *    storage (vision store path or temporary RustFS prefix).
 *  - {@link ChatAttachmentMetadata}: what the BACKEND persists in the
 *    ``HUMAN_MESSAGE`` trace and exposes through the ``Message`` projection
 *    (REQ-020/022) — id, filename, MIME, size, kind, source. NEVER base64
 *    content (REQ-021/075), NEVER an internal RustFS path (REQ-076).
 */
import type { McpServerConfig } from "@/domain/entities/agent/mcpServerConfig";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";

export type ChatAttachmentKind = "image" | "document";

export type ChatAttachmentSource = "langgraph_store" | "rustfs_temp";

export interface ChatAttachmentPayload {
  filename: string;
  content_type: string;
  content_base64: string;
}

export interface ChatAttachmentMetadata {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: ChatAttachmentKind;
  source: ChatAttachmentSource;
}

/** Metadata plus an optional client-side preview URL (object URL / data URL). */
export type ChatAttachmentDisplay = ChatAttachmentMetadata & { url?: string };

/** Images accepted by the vision path (REQ-007). */
export const SUPPORTED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/**
 * Document family mirrored from the existing REST upload backend
 * (mcp-raganything ALLOWED_EXTENSIONS), minus images handled by the vision
 * path (REQ-008). Used for the ``accept`` filter and client-side hints.
 */
export const SUPPORTED_DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  "pdf",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "md",
  "csv",
  "svg",
  "bmp",
  "html",
  "xml",
  "json",
  "rtf",
  "odt",
  "ods",
]);

/** MIME prefixes accepted for documents (mirrors ALLOWED_MIME_PREFIXES). */
export const SUPPORTED_DOCUMENT_MIME_PREFIXES: readonly string[] = [
  "application/pdf",
  "text/",
  "image/",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/json",
  "application/rtf",
  "application/vnd.oasis.opendocument",
];

/** Client-side limits mirroring the backend defaults (REQ-006 / REQ-092). */
export const CHAT_ATTACHMENT_MAX_COUNT = 10;
export const CHAT_ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export function attachmentKindFromContentType(contentType: string): ChatAttachmentKind {
  return contentType.startsWith("image/") ? "image" : "document";
}

export function sourceForKind(kind: ChatAttachmentKind): ChatAttachmentSource {
  return kind === "image" ? "langgraph_store" : "rustfs_temp";
}

/** File extension without the leading dot, or null when absent. */
export function fileExtension(filename: string): string | null {
  const idx = filename.lastIndexOf(".");
  if (idx <= 0 || idx === filename.length - 1) return null;
  return filename.slice(idx + 1).toLowerCase();
}

/** Strips trailing ``/`` characters — linear scans only, no regex (S8786). */
function stripTrailingSlashes(url: string): string {
  let end = url.length;
  // S7758: codePointAt over URL characters — "/" is an ASCII single-unit
  // code point (47), so the scan condition is unchanged; the in-range ?? 0
  // arm is unreachable (end is always a valid index here).
  while (end > 0 && (url.codePointAt(end - 1) ?? 0) === 47 /* "/" */) end -= 1;
  return url.slice(0, end);
}

/**
 * Document authorization policy (REQ-062 / REQ-009 client mirror): a document
 * may be attached only when the agent config declares an MCP HTTP server
 * whose URL ends with ``/files/mcp`` — ``/classical/mcp`` does NOT count
 * (EDG-009). The backend remains the single authority (NFR-010).
 */
export function documentsAllowedWithFilesMcp(
  mcpServers: Pick<McpServerConfig, "transport" | "url">[] | undefined | null,
): boolean {
  if (!mcpServers) return false;
  return mcpServers.some((server) => {
    if (server.transport !== McpTransportType.HTTP) return false;
    const url = server.url?.trim();
    if (!url) return false;
    return stripTrailingSlashes(url).endsWith("/files/mcp");
  });
}

/**
 * LangGraph Store path of a persisted image attachment (REQ-025/027):
 * ``/chat_attachments/<thread_id>/<attachment_id>/<filename>``. Documents are
 * temporary RustFS objects and are NEVER fetched by the UI (REQ-075).
 */
export function chatAttachmentStorePath(
  threadId: string,
  attachment: Pick<ChatAttachmentMetadata, "id" | "filename">,
): string {
  const safeName = attachment.filename.replace(/\/+/g, "_");
  return `/chat_attachments/${threadId}/${attachment.id}/${safeName}`;
}
