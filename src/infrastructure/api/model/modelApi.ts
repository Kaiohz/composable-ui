import type {
  ModelConfiguration,
  ModelCreateInput,
  ModelUpdateInput,
} from "@/domain/entities/model/modelConfiguration";
import type { IModelPort } from "@/domain/ports/model/modelPort";
import { apiClient } from "@/infrastructure/api/axiosInstance";

/**
 * Axios adapter for the metadata-only model catalog (§MDL-002): payloads
 * carry only the four MDL-001 metadata fields and never any credential.
 */
export const modelApi: IModelPort = {
  async listModels(): Promise<ModelConfiguration[]> {
    const response = await apiClient.get<ModelConfiguration[]>("/api/v1/models");
    return response.data;
  },

  async createModel(input: ModelCreateInput): Promise<ModelConfiguration> {
    const response = await apiClient.post<ModelConfiguration>("/api/v1/models", {
      name: input.name,
      provider: input.provider,
      provider_model: input.provider_model,
      base_url: input.base_url ?? null,
    });
    return response.data;
  },

  async getModel(id: string): Promise<ModelConfiguration> {
    const response = await apiClient.get<ModelConfiguration>(
      `/api/v1/models/${encodeURIComponent(id)}`,
    );
    return response.data;
  },

  async updateModel(id: string, patch: ModelUpdateInput): Promise<ModelConfiguration> {
    const response = await apiClient.patch<ModelConfiguration>(
      `/api/v1/models/${encodeURIComponent(id)}`,
      patch,
    );
    return response.data;
  },

  async deleteModel(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/models/${encodeURIComponent(id)}`);
  },
};
