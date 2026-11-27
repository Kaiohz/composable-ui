/**
 * RAG space record — one row of the `rag_spaces` table (REQ-009) as returned
 * by `GET /api/v1/spaces` (REQ-010, mcp-raganything `space_routes.py`).
 *
 * The records are raw backend shapes: columns have no `is_builtin` flag —
 * builtin ordering is resolved from the platform agent catalog
 * (`GET /api/v1/agents`, composable-agents).
 */
export const PERSONAL_SLUG = "personal";

/** REQ-002 slug charset, enforced server-side on every scoped route. */
export const AGENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function isValidSpaceSlug(slug: string): boolean {
  return AGENT_SLUG_PATTERN.test(slug);
}

export interface SpaceRecord {
  readonly agent_slug: string;
  readonly working_dirs: string[];
  readonly created_at: string;
  readonly last_used_at: string | null;
}

/**
 * Spaces-payload validation (REQ-019 + REQ-002, defense in depth): `personal`
 * is NEVER a provisioned `rag_spaces` row — the UI synthesizes the Personal
 * entry client-side (first, unduplicated) — so a `personal` row is dropped
 * while every other space survives. Rows whose slug violates the REQ-002
 * charset cannot select a scope and are dropped too.
 */
export function validateSpacesPayload(records: readonly SpaceRecord[]): SpaceRecord[] {
  return records.filter(
    (record) => record.agent_slug !== PERSONAL_SLUG && isValidSpaceSlug(record.agent_slug),
  );
}
