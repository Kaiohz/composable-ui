import type { FileEntry, FolderEntry } from "@/domain/entities/rag/fileEntry";

/**
 * Port for the mcp-raganything file surface (REQ-003/REQ-005).
 *
 * Every prefix/object path is a path RELATIVE TO THE CALLER'S SCOPE: the
 * backend composes `{user_id}/{agent_slug}/…` server-side from the
 * authenticated identity plus the `X-Composable-Agent` header, so the client
 * never builds storage keys. `agentSlug` selects the space (backend default:
 * `personal` when no header is sent); list responses return FULL object keys
 * for files and SCOPE-relative prefixes for folders (backend
 * `relativize_folders`).
 */
export interface IRagFilePort {
  listFolders(prefix?: string, agentSlug?: string): Promise<FolderEntry[]>;
  listFiles(prefix?: string, recursive?: boolean, agentSlug?: string): Promise<FileEntry[]>;
  uploadFile(
    prefix: string,
    file: File,
    agentSlug?: string,
  ): Promise<{ object_name: string; size: number; message: string }>;
  createFolder(prefix: string, agentSlug?: string): Promise<{ message: string }>;
  deleteFile(
    objectName: string,
    workingDir?: string,
    agentSlug?: string,
  ): Promise<{ message: string }>;
  deleteFolder(prefix: string, agentSlug?: string): Promise<{ message: string }>;
}
