/**
 * Spec: prompts-models-crons-traces.md §MDL-001..MDL-003 (model routes)
 * modelApi is the external adapter implementing IModelPort. Models are
 * metadata-only: the adapter must never send credential fields.
 *
 * Step-1 (Red): the adapter, port and module do not exist yet.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { modelApi } from "@/infrastructure/api/model/modelApi";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import { createModelConfiguration } from "../../../../fixtures/registries";

vi.mock("@/infrastructure/api/axiosInstance", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("modelApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists owned model metadata from GET /api/v1/models", async () => {
    const models = [createModelConfiguration()];
    vi.mocked(apiClient.get).mockResolvedValue({ data: models });

    const result = await modelApi.listModels();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/models");
    expect(result).toEqual(models);
  });

  it("creates a metadata configuration via POST /api/v1/models", async () => {
    const created = createModelConfiguration();
    vi.mocked(apiClient.post).mockResolvedValue({ data: created });

    const payload = {
      name: "Fast Haiku",
      provider: "openai",
      provider_model: "anthropic/claude-haiku-4.5",
      base_url: "https://api.example.com/v1",
    };

    const result = await modelApi.createModel(payload);

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/models", payload);
    expect(result).toEqual(created);
  });

  it("create payloads never contain credential fields (MDL-002)", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: createModelConfiguration() });

    await modelApi.createModel({
      name: "Fast Haiku",
      provider: "openai",
      provider_model: "anthropic/claude-haiku-4.5",
      base_url: null,
    });

    const sent = vi.mocked(apiClient.post).mock.calls[0][1] as Record<string, unknown>;
    for (const forbidden of ["api_key", "apiKey", "token", "secret", "password", "auth", "jwt"]) {
      expect(sent).not.toHaveProperty(forbidden);
    }
  });

  it("reads a model via GET /api/v1/models/{id}", async () => {
    const model = createModelConfiguration();
    vi.mocked(apiClient.get).mockResolvedValue({ data: model });

    const result = await modelApi.getModel(model.id);

    expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/models/${model.id}`);
    expect(result).toEqual(model);
  });

  it("edits provider/base URL/display name via PATCH /api/v1/models/{id}", async () => {
    const updated = createModelConfiguration({ provider: "anthropic" });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: updated });

    const result = await modelApi.updateModel("model-1", {
      provider: "anthropic",
    });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/models/model-1", {
      provider: "anthropic",
    });
    expect(result).toEqual(updated);
  });

  it("deletes via DELETE /api/v1/models/{id}", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await modelApi.deleteModel("model-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/models/model-1");
  });
});
