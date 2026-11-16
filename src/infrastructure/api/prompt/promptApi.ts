import type {
  PromptCreateInput,
  PromptMetadata,
  PromptMetadataUpdateInput,
  PromptVersion,
  PromptVersionCreateInput,
} from "@/domain/entities/prompt/prompt";
import type { IPromptPort } from "@/domain/ports/prompt/promptPort";
import { apiClient } from "@/infrastructure/api/axiosInstance";

/** Axios adapter for the per-user prompt registry. Never calls Phoenix. */
export const promptApi: IPromptPort = {
  async listPrompts(): Promise<PromptMetadata[]> {
    const response = await apiClient.get<PromptMetadata[]>("/api/v1/prompts");
    return response.data;
  },

  async createPrompt(input: PromptCreateInput): Promise<PromptMetadata> {
    const response = await apiClient.post<PromptMetadata>("/api/v1/prompts", {
      ...input,
      description: input.description ?? null,
    });
    return response.data;
  },

  async getPrompt(id: string): Promise<PromptMetadata> {
    const response = await apiClient.get<PromptMetadata>(
      `/api/v1/prompts/${encodeURIComponent(id)}`,
    );
    return response.data;
  },

  async updatePrompt(id: string, patch: PromptMetadataUpdateInput): Promise<PromptMetadata> {
    const response = await apiClient.patch<PromptMetadata>(
      `/api/v1/prompts/${encodeURIComponent(id)}`,
      patch,
    );
    return response.data;
  },

  async deletePrompt(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/prompts/${encodeURIComponent(id)}`);
  },

  async listVersions(promptId: string): Promise<PromptVersion[]> {
    const response = await apiClient.get<PromptVersion[]>(
      `/api/v1/prompts/${encodeURIComponent(promptId)}/versions`,
    );
    return response.data;
  },

  async createVersion(promptId: string, input: PromptVersionCreateInput): Promise<PromptVersion> {
    const response = await apiClient.post<PromptVersion>(
      `/api/v1/prompts/${encodeURIComponent(promptId)}/versions`,
      input,
    );
    return response.data;
  },

  async getVersion(promptId: string, version: number): Promise<PromptVersion> {
    const response = await apiClient.get<PromptVersion>(
      `/api/v1/prompts/${encodeURIComponent(promptId)}/versions/${version}`,
    );
    return response.data;
  },
};
