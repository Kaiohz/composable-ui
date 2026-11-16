/**
 * Prompt registry entity (spec §PR-002). Content is plain text used as an
 * agent system prompt. Versions are immutable and numerically sequential.
 */
export interface PromptMetadata {
  id: string;
  name: string;
  description: string | null;
  latest_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Version-list row (backend `PromptVersionSummary`): version number and
 * creation timestamp only. The immutable content of a version is fetched
 * separately through `GET /api/v1/prompts/{id}/versions/{version}` (QA
 * BUG-004) — the list endpoint never carries content.
 */
export interface PromptVersionSummary {
  prompt_id: string;
  version: number;
  created_at: string;
}

/** Full immutable version (`PromptVersionResponse` from the detail endpoint). */
export interface PromptVersion extends PromptVersionSummary {
  content: string;
}

/** POST /api/v1/prompts — creates metadata and immutable version 1. */
export interface PromptCreateInput {
  name: string;
  description?: string | null;
  content: string;
}

/** PATCH /api/v1/prompts/{id} — metadata only; content is never accepted. */
export interface PromptMetadataUpdateInput {
  name?: string;
  description?: string | null;
}

/** POST /api/v1/prompts/{id}/versions — the next immutable version. */
export interface PromptVersionCreateInput {
  content: string;
}
