/**
 * Chat PDF attachments fixtures — spec ``chat-pdf-attachments`` (§5.6).
 *
 * These fixtures model the ATTACHMENT METADATA contract persisted in the
 * trace (REQ-020) and exposed by the backend ``Message`` projection
 * (REQ-022): id, filename, MIME, size, kind, source — NEVER base64 content.
 */
import { createAgentConfig } from "./external";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";

export interface ChatAttachmentMetadata {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: "image" | "document";
  source: "langgraph_store" | "rustfs_temp";
}

export function createAttachmentMeta(
  overrides: Partial<ChatAttachmentMetadata> = {},
): ChatAttachmentMetadata {
  return {
    id: "att-1234",
    filename: "capture.png",
    content_type: "image/png",
    size_bytes: 12345,
    kind: "image",
    source: "langgraph_store",
    ...overrides,
  };
}

export function createDocumentAttachmentMeta(
  overrides: Partial<ChatAttachmentMetadata> = {},
): ChatAttachmentMetadata {
  return createAttachmentMeta({
    id: "att-doc-1",
    filename: "rapport.pdf",
    content_type: "application/pdf",
    size_bytes: 45678,
    kind: "document",
    source: "rustfs_temp",
    ...overrides,
  });
}

/** 1x1 transparent-ish PNG (tiny valid base64 payload for previews). */
export const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function agentWithFilesMcp(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return createAgentConfig({
    mcp_servers: [
      {
        name: "files-server",
        transport: McpTransportType.HTTP,
        args: [],
        url: "https://mcp.example.com/files/mcp",
        headers: {},
        env: {},
      },
    ],
    ...overrides,
  });
}

export function agentWithClassicalMcpOnly(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return createAgentConfig({
    mcp_servers: [
      {
        name: "classical-server",
        transport: McpTransportType.HTTP,
        args: [],
        url: "https://mcp.example.com/classical/mcp",
        headers: {},
        env: {},
      },
    ],
    ...overrides,
  });
}

export function agentWithoutMcp(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return createAgentConfig({ mcp_servers: [], ...overrides });
}

/** Tool result payload produced by the backend ``create_pdf`` tool (REQ-058). */
export function createPdfToolResult(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    path: "/documents/thread-123/00000000-0000-0000-0000-000000000001/rapport.pdf",
    filename: "rapport.pdf",
    mime_type: "application/pdf",
    ...overrides,
  });
}
