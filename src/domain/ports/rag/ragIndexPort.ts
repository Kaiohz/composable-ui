import type {
  ClassicalIndexFileRequest,
  ClassicalIndexFolderRequest,
} from "@/domain/entities/rag/indexingRequest";

/**
 * Port for the mcp-raganything classical indexing surface (REQ-006). The
 * `file_name`/`working_dir` request fields are RELATIVE to the caller's
 * scope; the backend composes `{user_id}/{agent_slug}/…` server-side.
 * `agentSlug` selects the space (backend default: `personal`).
 */
export interface IRagIndexPort {
  indexFileClassical(
    request: ClassicalIndexFileRequest,
    agentSlug?: string,
  ): Promise<{ status: string; message: string }>;
  indexFolderClassical(
    request: ClassicalIndexFolderRequest,
    agentSlug?: string,
  ): Promise<{ status: string; message: string }>;
}
