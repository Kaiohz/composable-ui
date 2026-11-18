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
}
