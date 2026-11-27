import { ragApiClient } from "@/infrastructure/api/ragAxiosInstance";
import type { IRagFilePort } from "@/domain/ports/rag/ragFilePort";
import { FileEntry, FolderEntry } from "@/domain/entities/rag/fileEntry";
import { scopedRequestConfig } from "@/infrastructure/api/rag/agentScopeHeader";

/**
 * Infrastructure adapter — implements {@link IRagFilePort} against
 * mcp-raganything. All paths are scope-RELATIVE (the backend composes
 * `{user_id}/{agent_slug}/…`, REQ-003) and the optional agent slug travels in
 * the `X-Composable-Agent` header (absent → the backend resolves `personal`).
 */
export const ragApi: IRagFilePort = {
  async listFolders(prefix?: string, agentSlug?: string) {
    const params = new URLSearchParams();
    if (prefix !== undefined) params.set("prefix", prefix);
    const qs = params.toString();
    const url = qs ? `/api/v1/files/folders?${qs}` : "/api/v1/files/folders";
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.get<string[]>(url, config)
      : await ragApiClient.get<string[]>(url);
    return response.data.map((p) => new FolderEntry({ prefix: p }));
  },

  async listFiles(prefix?: string, recursive = false, agentSlug?: string) {
    const params = new URLSearchParams({
      prefix: prefix ?? "",
      recursive: String(recursive),
    });
    const url = `/api/v1/files/list?${params}`;
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.get<
          { object_name: string; size: number; last_modified: string | null }[]
        >(url, config)
      : await ragApiClient.get<
          { object_name: string; size: number; last_modified: string | null }[]
        >(url);

    return response.data.map(
      (f) =>
        new FileEntry({
          objectName: f.object_name,
          size: f.size,
          lastModified: f.last_modified,
        }),
    );
  },

  async uploadFile(prefix: string, file: File, agentSlug?: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("prefix", prefix);
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.post("/api/v1/files/upload", formData, config)
      : await ragApiClient.post("/api/v1/files/upload", formData);
    return response.data;
  },

  async createFolder(prefix: string, agentSlug?: string): Promise<{ message: string }> {
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.post<{ message: string }>("/api/v1/files/folders", { prefix }, config)
      : await ragApiClient.post<{ message: string }>("/api/v1/files/folders", { prefix });
    return response.data;
  },

  async deleteFile(objectName: string, workingDir?: string, agentSlug?: string) {
    const params = new URLSearchParams({ object_name: objectName });
    // "" IS meaningful: it is the scope-root namespace the file was indexed
    // into (`workingDir || currentPrefix`). Dropping the param would make the
    // backend fall back to its legacy default working dir and orphan the
    // file's vectors, so working_dir is ALWAYS sent — explicitly empty for
    // the scope root (cross-repo contract with mcp-raganything's delete_file).
    params.set("working_dir", workingDir ?? "");
    const url = `/api/v1/files?${params.toString()}`;
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.delete<{ message: string }>(url, config)
      : await ragApiClient.delete<{ message: string }>(url);
    return response.data;
  },

  async deleteFolder(prefix: string, agentSlug?: string): Promise<{ message: string }> {
    const url = `/api/v1/files/folders?prefix=${encodeURIComponent(prefix)}`;
    const config = scopedRequestConfig(agentSlug);
    const response = config
      ? await ragApiClient.delete<{ message: string }>(url, config)
      : await ragApiClient.delete<{ message: string }>(url);
    return response.data;
  },
};
