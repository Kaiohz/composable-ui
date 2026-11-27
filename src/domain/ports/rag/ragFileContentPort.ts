import type { FileContentResponse } from "@/domain/entities/rag/fileContent";

/**
 * Port for the mcp-raganything file-content surface (REQ-003/REQ-005). The
 * `file_path` is RELATIVE to the caller's scope; the backend composes the
 * storage key server-side. `agentSlug` selects the space (default:
 * `personal`).
 */
export interface IRagFileContentPort {
  readFile(filePath: string, agentSlug?: string): Promise<FileContentResponse>;
}
