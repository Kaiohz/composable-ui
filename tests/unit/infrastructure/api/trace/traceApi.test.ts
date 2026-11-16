/**
 * Spec: prompts-models-crons-traces.md §TRC-001 (global trace list)
 * traceApi is the external adapter implementing ITracePort. The list uses
 * cursor pagination plus an exact-match, user-scoped agent filter; the
 * response shape is { items, next_cursor }.
 *
 * Step-1 (Red): the adapter, port and module do not exist yet.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { traceApi } from "@/infrastructure/api/trace/traceApi";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import { createTracePage } from "../../../../fixtures/registries";

vi.mock("@/infrastructure/api/axiosInstance", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("traceApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches summaries from GET /api/v1/traces with default pagination", async () => {
    const page = createTracePage();
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });

    const result = await traceApi.listTraces();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces", {
      params: { limit: 50 },
    });
    expect(result).toEqual(page);
    expect(result.next_cursor).toBeNull();
  });

  it("sends the exact agent name filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: createTracePage() });

    await traceApi.listTraces({ agentName: "digest-agent" });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces", {
      params: { agent_name: "digest-agent", limit: 50 },
    });
  });

  it("sends the cursor when paginating", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: createTracePage({ next_cursor: "cursor-2" }),
    });

    const result = await traceApi.listTraces({ cursor: "cursor-1" });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces", {
      params: { cursor: "cursor-1", limit: 50 },
    });
    expect(result.next_cursor).toBe("cursor-2");
  });

  it("supports combined filter + pagination + custom limit", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: createTracePage() });

    await traceApi.listTraces({
      agentName: "support-agent",
      cursor: "cursor-1",
      limit: 100,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces", {
      params: {
        agent_name: "support-agent",
        cursor: "cursor-1",
        limit: 100,
      },
    });
  });

  it("caps the client-side limit at the API maximum of 100", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: createTracePage() });

    await traceApi.listTraces({ limit: 500 });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces", {
      params: { limit: 100 },
    });
  });
});
