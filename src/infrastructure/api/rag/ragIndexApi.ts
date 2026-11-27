import { ragApiClient } from "@/infrastructure/api/ragAxiosInstance";
import type { IRagIndexPort } from "@/domain/ports/rag/ragIndexPort";
import { scopedRequestConfig } from "@/infrastructure/api/rag/agentScopeHeader";

/**
 * Infrastructure adapter for the classical indexing routes (REQ-006). The
 * request's `file_name`/`working_dir` are scope-relative; `agentSlug` travels
 * in the `X-Composable-Agent` header (absent → `personal`).
 */
export const ragIndexApi: IRagIndexPort = {
  async indexFileClassical(request, agentSlug?: string) {
    const body = {
      file_name: request.file_name,
      working_dir: request.working_dir,
      chunk_size: request.chunk_size,
      chunk_overlap: request.chunk_overlap,
    };
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.post<{ status: string; message: string }>(
          "/api/v1/classical/file/index",
          body,
          config,
        )
      : await ragApiClient.post<{ status: string; message: string }>(
          "/api/v1/classical/file/index",
          body,
        );
    return {
      status: response.data.status,
      message: response.data.message,
    };
  },

  async indexFolderClassical(request, agentSlug?: string) {
    const body: Record<string, unknown> = {
      working_dir: request.working_dir,
      recursive: request.recursive,
      chunk_size: request.chunk_size,
      chunk_overlap: request.chunk_overlap,
    };
    if (request.file_extensions) {
      body.file_extensions = request.file_extensions;
    }
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.post<{ status: string; message: string }>(
          "/api/v1/classical/folder/index",
          body,
          config,
        )
      : await ragApiClient.post<{ status: string; message: string }>(
          "/api/v1/classical/folder/index",
          body,
        );
    return {
      status: response.data.status,
      message: response.data.message,
    };
  },
};
