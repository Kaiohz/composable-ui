/**
 * Spec: LLM Usage Dashboard on /traces — Frontend §11-§13, Aggregations §26.
 * useTracesUsage must call GET /api/v1/traces/usage with the exact agent
 * filter, optional model filter and ISO period bounds, and every filter
 * must participate in the query key: changing any of them refetches with
 * the new bounds instead of serving another window's cache.
 *
 * Repo hook-test conventions: external adapter mocked at the network
 * boundary; hook runs with a real QueryClient.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useTracesUsage } from "@/application/hooks/trace/useTracesUsage";
import { llmUsageApi } from "@/infrastructure/api/trace/llmUsageApi";
import { createLlmUsageSummary } from "../../../fixtures/usage";

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

describe("useTracesUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the usage summary without filters by default", async () => {
    const summary = createLlmUsageSummary();
    vi.mocked(llmUsageApi.getUsageSummary).mockResolvedValue(summary);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTracesUsage(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(llmUsageApi.getUsageSummary).toHaveBeenCalledWith({});
    expect(result.current.data).toEqual(summary);
    expect(result.current.data?.total_tokens).toBe(15_000);
    expect(result.current.data?.series.by_agent).toHaveLength(1);
  });

  it("passes the exact agent and ISO period bounds to the adapter", async () => {
    vi.mocked(llmUsageApi.getUsageSummary).mockResolvedValue(createLlmUsageSummary());

    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useTracesUsage({
          agentName: "digest-agent",
          from: "2026-11-01T00:00:00.000Z",
          to: "2026-11-15T23:59:59.999Z",
        }),
      { wrapper },
    );

    await waitFor(() => expect(llmUsageApi.getUsageSummary).toHaveBeenCalled());
    expect(llmUsageApi.getUsageSummary).toHaveBeenCalledWith({
      agentName: "digest-agent",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-15T23:59:59.999Z",
    });
  });

  // NOTE (review C3): there is deliberately no "refetches when the model
  // filter changes" test — `LlmUsageFilter` carries only what the backend
  // accepts (agent name + period). The model filter narrows the RUNS LIST
  // client-side in `useTopRuns`; the summary stays backend-computed.

  it("refetches with the new filter when the exact agent filter changes", async () => {
    vi.mocked(llmUsageApi.getUsageSummary).mockResolvedValue(createLlmUsageSummary());

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      (props: { agentName?: string }) => useTracesUsage({ ...props }),
      { initialProps: { agentName: "digest-agent" }, wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCalls = vi.mocked(llmUsageApi.getUsageSummary).mock.calls.length;

    rerender({ agentName: "support-agent" });

    await waitFor(() =>
      expect(llmUsageApi.getUsageSummary).toHaveBeenLastCalledWith({ agentName: "support-agent" }),
    );
    // The query key changed → a genuinely new fetch, not a cache hit.
    expect(vi.mocked(llmUsageApi.getUsageSummary).mock.calls.length).toBeGreaterThan(firstCalls);
  });

  it("refetches when the period bounds change so windows never leak", async () => {
    vi.mocked(llmUsageApi.getUsageSummary).mockResolvedValue(createLlmUsageSummary());

    const { wrapper } = createWrapper();
    const { rerender } = renderHook(
      (props: { from?: string; to?: string }) => useTracesUsage({ ...props }),
      { initialProps: { from: "2026-11-01T00:00:00.000Z" }, wrapper },
    );

    await waitFor(() => expect(llmUsageApi.getUsageSummary).toHaveBeenCalled());

    rerender({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-31T23:59:59.999Z" });

    await waitFor(() =>
      expect(llmUsageApi.getUsageSummary).toHaveBeenLastCalledWith({
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-10-31T23:59:59.999Z",
      }),
    );
  });

  it("surfaces the server failure without retrying", async () => {
    vi.mocked(llmUsageApi.getUsageSummary).mockRejectedValue(new Error("Usage service down"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTracesUsage(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Usage service down");
    expect(result.current.data).toBeUndefined();
  });

  it("recovers when refetch is called after a server failure", async () => {
    vi.mocked(llmUsageApi.getUsageSummary)
      .mockRejectedValueOnce(new Error("Usage service down"))
      .mockResolvedValueOnce(createLlmUsageSummary());

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTracesUsage(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // The UI retry button triggers this refetch: a genuinely new request
    // that must restore the data instead of replaying the cached error.
    await result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total_tokens).toBe(15_000);
    expect(vi.mocked(llmUsageApi.getUsageSummary)).toHaveBeenCalledTimes(2);
  });
});
