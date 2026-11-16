/**
 * Spec: LLM Usage Dashboard on /traces — Frontend §10, Aggregations §28-§30.
 * useTopRuns must call GET /api/v1/traces/usage/top with the default or
 * selected limit and the shared filters; the limit participates in the
 * query key exactly like the filters, so the Runs tab limit control
 * refetches instead of slicing a cached page.
 *
 * The model filter has NO server counterpart (the endpoint accepts no
 * `model_name` — review C3): it narrows the fetched runs CLIENT-SIDE,
 * without any additional request, and never reaches the adapter params.
 * With a model filter active the FETCH pool widens to the endpoint cap of
 * 100 so the narrowing is meaningful over cheap models (BUG-004).
 *
 * Repo hook-test conventions: external adapter mocked at the network
 * boundary; hook runs with a real QueryClient.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useTopRuns } from "@/application/hooks/trace/useTopRuns";
import { llmUsageApi } from "@/infrastructure/api/trace/llmUsageApi";
import { createLlmUsageRun } from "../../../fixtures/usage";

vi.mock("@/infrastructure/api/trace/llmUsageApi", () => ({
  llmUsageApi: {
    getUsageSummary: vi.fn(),
    getTopRuns: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient,
  };
}

describe("useTopRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the top runs without filters and with the default limit of 10", async () => {
    const runs = [createLlmUsageRun()];
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue(runs);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTopRuns(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // No limit given → the hook forwards none and the adapter applies the
    // default of 10 (asserted in the llmUsageApi adapter tests).
    expect(llmUsageApi.getTopRuns).toHaveBeenCalledWith({});
    expect(result.current.data).toEqual(runs);
  });

  it("passes the custom limit together with the shared filters", async () => {
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue([createLlmUsageRun()]);

    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useTopRuns({
          agentName: "digest-agent",
          from: "2026-11-01T00:00:00.000Z",
          to: "2026-11-15T23:59:59.999Z",
          limit: 50,
        }),
      { wrapper },
    );

    await waitFor(() => expect(llmUsageApi.getTopRuns).toHaveBeenCalled());
    expect(llmUsageApi.getTopRuns).toHaveBeenCalledWith({
      agentName: "digest-agent",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-15T23:59:59.999Z",
      limit: 50,
    });
  });

  it("refetches when the limit changes (the limit is part of the query key)", async () => {
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue([createLlmUsageRun()]);

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook((props: { limit?: number }) => useTopRuns(props), {
      initialProps: { limit: 10 },
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCalls = vi.mocked(llmUsageApi.getTopRuns).mock.calls.length;

    rerender({ limit: 25 });

    await waitFor(() => expect(llmUsageApi.getTopRuns).toHaveBeenLastCalledWith({ limit: 25 }));
    expect(vi.mocked(llmUsageApi.getTopRuns).mock.calls.length).toBeGreaterThan(firstCalls);
  });

  it("refetches when the exact agent filter changes", async () => {
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue([createLlmUsageRun()]);

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook((props: { agentName?: string }) => useTopRuns(props), {
      initialProps: { agentName: "digest-agent" },
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCalls = vi.mocked(llmUsageApi.getTopRuns).mock.calls.length;

    rerender({ agentName: "support-agent" });

    await waitFor(() =>
      expect(llmUsageApi.getTopRuns).toHaveBeenLastCalledWith({ agentName: "support-agent" }),
    );
    expect(vi.mocked(llmUsageApi.getTopRuns).mock.calls.length).toBeGreaterThan(firstCalls);
  });

  it("narrows the fetched runs client-side by model WITHOUT refetching between models (review C3)", async () => {
    const claudeRun = createLlmUsageRun({ thread_id: "aaaaaaaa-1111-4111-8111-111111111111" });
    const openAiRun = createLlmUsageRun({
      thread_id: "bbbbbbbb-2222-4224-8222-222222222222",
      model_name: "gpt-4o",
    });
    const allRuns = [claudeRun, openAiRun];
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue(allRuns);

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      (props: { modelName?: string }) => useTopRuns({ ...props }),
      { initialProps: { modelName: "gpt-4o" }, wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // BUG-004: with a model filter active the fetch pool widens to the
    // endpoint's cap (100) — the selected model's runs may rank below the
    // default top-10.
    expect(llmUsageApi.getTopRuns).toHaveBeenCalledWith({ limit: 100 });
    // Only the gpt-4o rows survive the client-side filter.
    expect(result.current.data).toEqual([openAiRun]);

    // Switching models re-filters instantly from the cache — no new fetch.
    const callsAfterFirstFetch = vi.mocked(llmUsageApi.getTopRuns).mock.calls.length;
    rerender({ modelName: "claude-sonnet-4-5" });
    await waitFor(() => expect(result.current.data).toEqual([claudeRun]));
    expect(vi.mocked(llmUsageApi.getTopRuns).mock.calls.length).toBe(callsAfterFirstFetch);
    expect(llmUsageApi.getTopRuns).toHaveBeenLastCalledWith({ limit: 100 });

    // Clearing the model narrows the fetch back and uncovers every run.
    rerender({});
    await waitFor(() => expect(result.current.data).toEqual(allRuns));
    await waitFor(() => expect(llmUsageApi.getTopRuns).toHaveBeenLastCalledWith({}));
    expect(vi.mocked(llmUsageApi.getTopRuns).mock.calls.length).toBeGreaterThan(
      callsAfterFirstFetch,
    );
  });

  it("widens the model-filtered fetch to 100 and unwidens on clear (BUG-004)", async () => {
    const runs = [createLlmUsageRun()];
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue(runs);

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      (props: { limit?: number; modelName?: string }) => useTopRuns({ ...props }),
      { initialProps: { limit: 10, modelName: "gpt-4o" }, wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The user's limit no longer bounds the FETCH when a model filter is
    // active — the pool is the endpoint cap, the limit is applied after
    // the narrowing.
    expect(llmUsageApi.getTopRuns).toHaveBeenCalledWith({ limit: 100 });

    // Clearing the model changes the query key — a fresh fetch comes back.
    rerender({ limit: 10 });
    await waitFor(() => expect(llmUsageApi.getTopRuns).toHaveBeenLastCalledWith({ limit: 10 }));
    await waitFor(() => expect(result.current.data).toEqual(runs));
  });

  it("applies the selected limit AFTER the model narrowing (top N of the model)", async () => {
    const runs = [
      createLlmUsageRun({ thread_id: "t1", cost_usd: 0.3 }),
      createLlmUsageRun({ thread_id: "t2", cost_usd: 0.2, model_name: "gpt-4o" }),
      createLlmUsageRun({ thread_id: "t3", cost_usd: 0.1, model_name: "gpt-4o" }),
    ];
    vi.mocked(llmUsageApi.getTopRuns).mockResolvedValue(runs);

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      (props: { limit?: number; modelName?: string }) => useTopRuns({ ...props }),
      { initialProps: { limit: 2, modelName: "gpt-4o" }, wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The two cheapest gpt-4o runs of the widened pool, cost-descending.
    expect(result.current.data).toEqual([runs[1], runs[2]]);

    // Clearing the model stops the narrowing; the limit still slices.
    rerender({ limit: 2 });
    await waitFor(() => {
      expect(result.current.data).toEqual([runs[0], runs[1]]);
    });
  });

  it("surfaces the server failure without retrying", async () => {
    vi.mocked(llmUsageApi.getTopRuns).mockRejectedValue(new Error("Top runs unavailable"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTopRuns(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Top runs unavailable");
    expect(result.current.data).toBeUndefined();
  });

  it("recovers when refetch is called after a server failure", async () => {
    vi.mocked(llmUsageApi.getTopRuns)
      .mockRejectedValueOnce(new Error("Top runs unavailable"))
      .mockResolvedValueOnce([createLlmUsageRun()]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTopRuns(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    await result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(vi.mocked(llmUsageApi.getTopRuns)).toHaveBeenCalledTimes(2);
  });
});
