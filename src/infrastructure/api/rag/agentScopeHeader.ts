/**
 * The caller-scope HTTP header (scope-rag-memories spec REQ-001/REQ-002):
 * `X-Composable-Agent` selects the space on every mcp-raganything request —
 * absent (or absent agent slug) means the backend resolves `personal`.
 *
 * The scope itself (`{user_id}/{agent_slug}/…`) is composed SERVER-SIDE from
 * the authenticated identity; the client only carries the slug.
 */
export const AGENT_SCOPE_HEADER = "X-Composable-Agent";

export type ScopedRequestConfig = { headers: Record<string, string> } | undefined;

/**
 * Builds the axios request config carrying the scope header, or `undefined`
 * when no agent slug is given — callers then issue the request WITHOUT a
 * config so the wire shape stays identical to the header-less (personal)
 * call.
 */
export function scopedRequestConfig(agentSlug: string | undefined): ScopedRequestConfig {
  if (!agentSlug) return undefined;
  return { headers: { [AGENT_SCOPE_HEADER]: agentSlug } };
}
