/**
 * Detection of the backend's non-sensitive LLM-not-configured error
 * (composable-agents `ErrorMessage.LLM_NOT_CONFIGURED`, spec
 * feat-composable-mcp.md §REQ-041/§REQ-052). The UI only matches a stable,
 * credential-free signature; the raw message keeps being rendered verbatim
 * and no credential material is ever displayed.
 */
const LLM_NOT_CONFIGURED_PATTERN = /^\s*no llm provider configured\b/i;

/**
 * Whether a chat error means the user has no LLM provider configured and
 * should be directed to `/settings`. Accepts the raw string from the chat
 * store or an `Error` instance defensively; anything else is not treated as
 * this onboarding failure.
 */
export function isLlmNotConfiguredError(error: unknown): boolean {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
  if (message === null) return false;
  return LLM_NOT_CONFIGURED_PATTERN.test(message);
}
