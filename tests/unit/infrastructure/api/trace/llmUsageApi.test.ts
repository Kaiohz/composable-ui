/**
 * Spec: LLM Usage Dashboard on /traces — Aggregations §26-§30.
 * llmUsageApi is the external adapter implementing ILlmUsagePort against
 * `GET /api/v1/traces/usage` (global aggregates + per-agent/per-model
 * series) and `GET /api/v1/traces/usage/top` (**envelope**
 * `{"items": [...]}` — backend `TopRunsResponse`, asserted by the backend
 * behavioral test). The accepted params are `agent_name`/`from`/`to`
 * (+ `limit`); there is NO `model_name` — FastAPI would silently ignore it
 * (review C3) and the runs list filters client-side instead.
 * Every response is parsed against the domain Zod schemas: a contract
 * drift surfaces as a rejection, not a bad object reaching the UI (C1/I1).
 * Fixtures mirror the REAL backend field sets (`response_model_exclude_none`
 * drops absent optionals).
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { llmUsageApi } from "@/infrastructure/api/trace/llmUsageApi";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import {
  createLlmAgentUsage,
  createLlmModelUsage,
  createLlmUsageRun,
  createLlmUsageSummary,
} from "../../../../fixtures/usage";

vi.mock("@/infrastructure/api/axiosInstance", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("llmUsageApi — usage summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches aggregates from GET /api/v1/traces/usage without filters by default", async () => {
    const summary = createLlmUsageSummary();
    vi.mocked(apiClient.get).mockResolvedValue({ data: summary });

    const result = await llmUsageApi.getUsageSummary();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces/usage", { params: {} });
    expect(result).toEqual(summary);
    expect(result.series.by_agent).toHaveLength(1);
    expect(result.series.by_model).toHaveLength(1);
  });

  it("sends the exact agent name and ISO period bounds as snake_case params", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: createLlmUsageSummary() });

    await llmUsageApi.getUsageSummary({
      agentName: "digest-agent",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-15T23:59:59.999Z",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces/usage", {
      params: {
        agent_name: "digest-agent",
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-15T23:59:59.999Z",
      },
    });
  });

  it("never sends model_name — the endpoint accepts no model filter (review C3)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: createLlmUsageSummary() });

    await llmUsageApi.getUsageSummary({
      agentName: "digest-agent",
      // modelName is not part of the port type anymore; the adapter must
      // not put any model parameter on the wire.
      from: "2026-11-01T00:00:00.000Z",
    });

    const params = vi.mocked(apiClient.get).mock.calls[0]?.[1]?.params as Record<string, string>;
    expect(Object.keys(params)).not.toContain("model_name");
  });

  it("omits params the caller did not provide", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: createLlmUsageSummary() });

    await llmUsageApi.getUsageSummary({ agentName: "support-agent" });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces/usage", {
      params: { agent_name: "support-agent" },
    });
  });

  it("returns unpriced model breakdowns verbatim (cost 0, priced false)", async () => {
    const unpricedModel = createLlmModelUsage({
      model_name: "local-llama",
      provider: null,
      cost_usd: 0,
      priced: false,
    });
    const summary = createLlmUsageSummary({
      total_cost_usd: 0,
      series: { by_agent: [createLlmAgentUsage()], by_model: [unpricedModel] },
    });
    vi.mocked(apiClient.get).mockResolvedValue({ data: summary });

    const result = await llmUsageApi.getUsageSummary();

    // Spec §7/§17: unknown models must not break the pipeline — the adapter
    // carries `cost=0` + `priced=false` through untouched for the dashboard.
    expect(result).toEqual(summary);
    expect(result.series.by_model[0].priced).toBe(false);
    expect(result.series.by_model[0].cost_usd).toBe(0);
  });

  it("rejects a summary whose series keys were dropped — drift surfaces as a query error", async () => {
    // This client never sends `group_by`, so the route always returns BOTH
    // series members; an absent member is contract drift and must surface
    // at parse time (review I1) instead of silently emptying the charts.
    const summary = createLlmUsageSummary();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { ...summary, series: {} },
    });

    await expect(llmUsageApi.getUsageSummary()).rejects.toThrow();
  });

  it("rejects a malformed summary payload with a HUMAN-READABLE message (BUG-003)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { unexpected: "shape", run_count: "not-a-number" },
    });

    const rejection = await llmUsageApi.getUsageSummary().then(
      () => null,
      (error: Error) => error,
    );
    expect(rejection).toBeInstanceOf(Error);
    // ErrorRow renders error.message: a short, actionable sentence —
    // never the raw Zod issue JSON.
    expect(rejection?.message).toBe(
      "Usage data format unexpected — retry or adjust filters (usage summary)",
    );
    expect(rejection?.message).not.toMatch(/"code"|"expected"|invalid_type/);

    // The technical detail stays non-user-facing on Error.cause.
    const cause = (rejection as Error & { cause?: unknown }).cause;
    expect(cause).toBeInstanceOf(Error);
    expect((cause as { issues?: unknown[] }).issues?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("llmUsageApi — top runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps the backend's { items: [...] } envelope (review C1 — the crash repro)", async () => {
    const runs = [createLlmUsageRun()];
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: runs } });

    const result = await llmUsageApi.getTopRuns();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces/usage/top", {
      params: { limit: 10 },
    });
    expect(result).toHaveLength(1);
    expect(result[0].thread_id).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("passes the custom limit and the shared filters together", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [createLlmUsageRun()] } });

    await llmUsageApi.getTopRuns({
      agentName: "digest-agent",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-15T23:59:59.999Z",
      limit: 25,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces/usage/top", {
      params: {
        agent_name: "digest-agent",
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-15T23:59:59.999Z",
        limit: 25,
      },
    });
  });

  it("caps the client-side limit at the API maximum of 100", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [] } });

    await llmUsageApi.getTopRuns({ limit: 500 });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/traces/usage/top", {
      params: { limit: 100 },
    });
  });

  it("never sends model_name to the top endpoint either (review C3)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [] } });

    await llmUsageApi.getTopRuns({ limit: 10 });

    const params = vi.mocked(apiClient.get).mock.calls[0]?.[1]?.params as Record<string, string>;
    expect(params).toEqual({ limit: 10 });
  });

  it("returns legacy runs with null turn/model/duration verbatim", async () => {
    // Pre-llm_usage runs (spec non-goals): no-cost/no-token, nullable fields
    // pass through exactly as the client contract normalises them.
    const legacyRun = createLlmUsageRun({
      turn_id: null,
      model_name: null,
      duration_ms: null,
    });
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [legacyRun] } });

    const result = await llmUsageApi.getTopRuns({ limit: 5 });

    expect(result).toEqual([legacyRun]);
    expect(result[0].turn_id).toBeNull();
    expect(result[0].model_name).toBeNull();
    expect(result[0].duration_ms).toBeNull();
  });

  it("rejects a bare-array or otherwise malformed top payload with a readable message, too", async () => {
    // The shape the OLD adapter wrongly assumed — and the kind of drift the
    // parse now stops before it reaches the component (review C1/I1), with
    // a short sentence instead of a Zod dump (BUG-003).
    vi.mocked(apiClient.get).mockResolvedValue({ data: [createLlmUsageRun()] });

    const rejection = await llmUsageApi.getTopRuns().then(
      () => null,
      (error: Error) => error,
    );
    expect(rejection?.message).toBe(
      "Usage data format unexpected — retry or adjust filters (top runs)",
    );
    expect(rejection?.message).not.toMatch(/"code"|"expected"|invalid_type/);
  });
});
