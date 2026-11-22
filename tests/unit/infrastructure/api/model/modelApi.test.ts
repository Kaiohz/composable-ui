/**
 * Spec: model-catalog-settings-only.md §B (MODEL-001..MODEL-005) — modelApi
 * is the external adapter implementing IModelPort. Under the new contract a
 * Model is identity-only: the adapter must send and accept ONLY
 * ``name`` / ``provider_model`` (plus identity/timestamps on responses) —
 * never ``provider``, ``base_url`` or any credential field.
 *
 * Step-1 (Red): the adapter still sends the legacy ``provider`` and
 * ``base_url`` fields.
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

  it("lists owned model configurations from GET /api/v1/models", async () => {
    const models = [createModelConfiguration()];
    vi.mocked(apiClient.get).mockResolvedValue({ data: models });

    const result = await modelApi.listModels();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/models");
    expect(result).toEqual(models);
  });

  it("creates an identity-only configuration via POST /api/v1/models", async () => {
    const created = createModelConfiguration();
    vi.mocked(apiClient.post).mockResolvedValue({ data: created });

    const result = await modelApi.createModel({
      name: "GLM 5.3 Flash",
      provider_model: "z-ai/glm-5.3-flash:nitro",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/models", {
      name: "GLM 5.3 Flash",
      provider_model: "z-ai/glm-5.3-flash:nitro",
    });
    expect(result).toEqual(created);
  });

  it("create payloads never contain the removed fields (name/provider_model contract)", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: createModelConfiguration() });

    await modelApi.createModel({
      name: "Fast Haiku",
      provider_model: "anthropic/claude-haiku-4.5",
    });

    const sent = vi.mocked(apiClient.post).mock.calls[0][1] as Record<string, unknown>;
    // The connection surface is user LLM Settings' — never sent by the
    // adapter, not even as `null`.
    expect(sent).not.toHaveProperty("provider");
    expect(sent).not.toHaveProperty("base_url");
    // And never any credential field either.
    for (const forbidden of ["api_key", "apiKey", "token", "secret", "password", "auth", "jwt"]) {
      expect(sent).not.toHaveProperty(forbidden);
    }
    expect(Object.keys(sent).sort()).toEqual(["name", "provider_model"]);
  });

  it("reads a model via GET /api/v1/models/{id}", async () => {
    const model = createModelConfiguration();
    vi.mocked(apiClient.get).mockResolvedValue({ data: model });

    const result = await modelApi.getModel(model.id);

    expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/models/${model.id}`);
    expect(result).toEqual(model);
  });

  it("edits provider_model via PATCH /api/v1/models/{id}", async () => {
    const updated = createModelConfiguration({ provider_model: "z-ai/glm-5.3-flash:nitro" });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: updated });

    const result = await modelApi.updateModel("model-1", {
      provider_model: "z-ai/glm-5.3-flash:nitro",
    });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/models/model-1", {
      provider_model: "z-ai/glm-5.3-flash:nitro",
    });
    expect(result).toEqual(updated);
  });

  it("edits the display name via PATCH /api/v1/models/{id}", async () => {
    const updated = createModelConfiguration({ name: "Renamed" });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: updated });

    const result = await modelApi.updateModel("model-1", { name: "Renamed" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/models/model-1", { name: "Renamed" });
    expect(result).toEqual(updated);
  });

  it("patch payloads never contain the removed fields", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: createModelConfiguration() });

    await modelApi.updateModel("model-1", { name: "Fast Haiku" });

    const sent = vi.mocked(apiClient.patch).mock.calls[0][1] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("provider");
    expect(sent).not.toHaveProperty("base_url");
  });

  it("deletes via DELETE /api/v1/models/{id}", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await modelApi.deleteModel("model-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/models/model-1");
  });
});
