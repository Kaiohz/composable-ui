export enum MessageRole {
  HUMAN = "human",
  AI = "ai",
  SYSTEM = "system",
  TOOL = "tool",
}

export enum MessageStatus {
  COMPLETED = "completed",
  AWAITING_HITL = "awaiting_hitl",
}

import type { ChatAttachmentMetadata } from "./attachment";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
  tool_calls: ToolCall[] | null;
  status: MessageStatus | null;
  structured_response: unknown;
  thinking: string | null;
  turn_id: string | null;
  /**
   * Attachment METADATA projection for human messages (REQ-020/022):
   * id / filename / MIME / size / kind / source — never base64 content
   * (REQ-021) and never an internal RustFS path (REQ-076).
   */
  attachments?: ChatAttachmentMetadata[] | null;
}
