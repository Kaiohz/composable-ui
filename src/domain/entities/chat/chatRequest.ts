export type HITLAction = "approve" | "reject" | "edit";

import type { ChatAttachmentPayload } from "./attachment";

export interface HitlDecisionInput {
  tool_call_id: string;
  action: HITLAction;
  reason?: string;
  edits?: Record<string, unknown>;
}

export interface ChatRequest {
  message?: string;
  /** Optional chat attachments (REQ-001): filename / MIME / base64 content. */
  attachments?: ChatAttachmentPayload[];
  tool_call_id?: string;
  action?: HITLAction;
  reason?: string;
  edits?: Record<string, unknown>;
  decisions?: HitlDecisionInput[];
  /**
   * Thinking level for THIS turn (chat composer selector). Omitted → thinking
   * off: the backend applies no reasoning payload to the LLM call.
   */
  reasoning_effort?: ReasoningEffort;
}

export type ReasoningEffort = "low" | "medium" | "high";
