/**
 * Spec: prompts-models-crons-traces.md §PR-004..PR-005 (prompt routes)
 * promptApi is the external adapter implementing IPromptPort; the suite
 * mocks the axios network boundary and asserts the HTTP contract.
 *
 * Step-1 (Red): the adapter, port and module do not exist yet.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import { createPromptMetadata, createPromptVersion } from "../../../../fixtures/registries";

vi.mock("@/infrastructure/api/axiosInstance", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("promptApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPrompts", () => {
    it("fetches owned prompt metadata from GET /api/v1/prompts", async () => {
      const prompts = [createPromptMetadata()];
      vi.mocked(apiClient.get).mockResolvedValue({ data: prompts });

      const result = await promptApi.listPrompts();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/prompts");
      expect(result).toEqual(prompts);
    });
  });

  describe("createPrompt", () => {
    it("posts metadata + content to POST /api/v1/prompts", async () => {
      const created = createPromptMetadata({ latest_version: 1 });
      vi.mocked(apiClient.post).mockResolvedValue({ data: created });

      const result = await promptApi.createPrompt({
        name: "release-notes",
        description: null,
        content: "You are a release notes writer.",
      });

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/prompts", {
        name: "release-notes",
        description: null,
        content: "You are a release notes writer.",
      });
      expect(result).toEqual(created);
    });
  });

  describe("getPrompt", () => {
    it("fetches a single prompt from GET /api/v1/prompts/{id}", async () => {
      const prompt = createPromptMetadata();
      vi.mocked(apiClient.get).mockResolvedValue({ data: prompt });

      const result = await promptApi.getPrompt(prompt.id);

      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/prompts/${prompt.id}`);
      expect(result).toEqual(prompt);
    });
  });

  describe("updatePrompt", () => {
    it("patches name/description via PATCH /api/v1/prompts/{id} without content", async () => {
      const updated = createPromptMetadata({ name: "renamed" });
      vi.mocked(apiClient.patch).mockResolvedValue({ data: updated });

      const result = await promptApi.updatePrompt("prompt-1", {
        name: "renamed",
        description: "new description",
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/prompts/prompt-1", {
        name: "renamed",
        description: "new description",
      });
      expect(result).toEqual(updated);
    });
  });

  describe("deletePrompt", () => {
    it("sends DELETE /api/v1/prompts/{id}", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({});

      await promptApi.deletePrompt("prompt-1");

      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/prompts/prompt-1");
    });
  });

  describe("versions", () => {
    it("lists version identity/timestamps via GET /api/v1/prompts/{id}/versions", async () => {
      const versions = [
        createPromptVersion({ version: 1 }),
        createPromptVersion({ version: 2, created_at: "2026-11-11T10:00:00Z" }),
      ];
      vi.mocked(apiClient.get).mockResolvedValue({ data: versions });

      const result = await promptApi.listVersions("prompt-1");

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/prompts/prompt-1/versions");
      expect(result).toEqual(versions);
    });

    it("creates the next immutable version via POST /api/v1/prompts/{id}/versions", async () => {
      const created = createPromptVersion({ version: 3 });
      vi.mocked(apiClient.post).mockResolvedValue({ data: created });

      const result = await promptApi.createVersion("prompt-1", {
        content: "New wording",
      });

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/prompts/prompt-1/versions", {
        content: "New wording",
      });
      expect(result).toEqual(created);
    });

    it("fetches full immutable content via GET /api/v1/prompts/{id}/versions/{version}", async () => {
      const version = createPromptVersion({ version: 2, content: "Second" });
      vi.mocked(apiClient.get).mockResolvedValue({ data: version });

      const result = await promptApi.getVersion("prompt-1", 2);

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/prompts/prompt-1/versions/2");
      expect(result).toEqual(version);
    });
  });

  describe("ownership scoping", () => {
    it("encodes identifiers in URLs", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });

      await promptApi.getPrompt("odd id");

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/prompts/odd%20id");
    });
  });
});
