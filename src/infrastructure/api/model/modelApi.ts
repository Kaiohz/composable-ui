import type {
  ModelConfiguration,
  ModelCreateInput,
  ModelUpdateInput,
} from "@/domain/entities/model/modelConfiguration";
import type { IModelPort } from "@/domain/ports/model/modelPort";
import { apiClient } from "@/infrastructure/api/axiosInstance";

/**
 * Axios adapter for the identity-only model catalog (model-catalog-settings-
 * only.md §B): payloads carry only `name` / `provider_model` — never
 * `provider`, `base_url` or any credential field, not even as `null`.
 */
export const modelApi: IModelPort = {
  async listModels(): Promise<ModelConfiguration[]> {
    const response = await apiClient.get<ModelConfiguration[]>("/api/v1/models");
    return response.data;
  },

  async createModel(input: ModelCreateInput): Promise<ModelConfiguration> {
    // POST accepts exactly `name` and `provider_model` (MODEL-002); the
    // provider connection is user LLM Settings data and is never sent.
    const response = await apiClient.post<ModelConfiguration>("/api/v1/models", {
      name: input.name,
      provider_model: input.provider_model,
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
