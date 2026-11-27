import { ragApiClient } from "@/infrastructure/api/ragAxiosInstance";
import type { IRagFileContentPort } from "@/domain/ports/rag/ragFileContentPort";
import type { FileContentResponse } from "@/domain/entities/rag/fileContent";
import { scopedRequestConfig } from "@/infrastructure/api/rag/agentScopeHeader";

/**
 * Infrastructure adapter for `POST /api/v1/files/read` (REQ-003/REQ-005).
 * `file_path` is scope-relative; `agentSlug` travels in the
 * `X-Composable-Agent` header (absent → `personal`).
 */
export const ragFileContentApi: IRagFileContentPort = {
  async readFile(filePath: string, agentSlug?: string): Promise<FileContentResponse> {
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.post<{
          content: { page: number; content: string }[];
          metadata: { format_type: string; mime_type: string } | null;
          tables: { markdown: string }[] | null;
        }>("/api/v1/files/read", { file_path: filePath }, config)
      : await ragApiClient.post<{
          content: { page: number; content: string }[];
          metadata: { format_type: string; mime_type: string } | null;
          tables: { markdown: string }[] | null;
        }>("/api/v1/files/read", { file_path: filePath });

    return {
      content: response.data.content,
      metadata: response.data.metadata,
      tables: response.data.tables,
    };
  },
};
