/**
 * Spec: prompts-models-crons-traces.md §TRC-001, §TRC-004
 * useTraces must call GET /api/v1/traces with the exact agent filter, and
 * paginate via useInfiniteQuery so that consecutive pages ACCUMULATE: the
 * `Load more` control appends rows (a cursor is only ever applied to the
 * NEXT request) and changing the filter resets to page one because the
 * filter is part of the query key.
 *
 * Repo hook-test conventions: external adapter mocked at the network
 * boundary; hook runs with a real QueryClient.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useTraces } from "@/application/hooks/trace/useTraces";
import { traceApi } from "@/infrastructure/api/trace/traceApi";
import { createTracePage } from "../../../fixtures/registries";

vi.mock("@/infrastructure/api/trace/traceApi", () => ({
  traceApi: {
    listTraces: vi.fn(),
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

describe("useTraces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the first page without a cursor", async () => {
    const page = createTracePage();
    vi.mocked(traceApi.listTraces).mockResolvedValue(page);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTraces({ agentName: undefined }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(traceApi.listTraces).toHaveBeenCalledWith({
      agentName: undefined,
      cursor: undefined,
    });
    expect(result.current.data?.pages).toEqual([page]);
  });

  it("applies an exact agent filter as part of the query key so it refetches", async () => {
    vi.mocked(traceApi.listTraces).mockResolvedValue(createTracePage());

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      (props: { agentName?: string }) => useTraces({ ...props }),
      { initialProps: { agentName: undefined }, wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCalls = vi.mocked(traceApi.listTraces).mock.calls.length;

    rerender({ agentName: "digest-agent" });

    await waitFor(() => {
      expect(vi.mocked(traceApi.listTraces)).toHaveBeenCalledWith({
        agentName: "digest-agent",
        cursor: undefined,
      });
    });
    expect(vi.mocked(traceApi.listTraces).mock.calls.length).toBeGreaterThan(firstCalls);
  });

  it("appends the next page when Load more fetches, applying the next_cursor", async () => {
    const pageOne = createTracePage({ next_cursor: "cursor-2" });
    const pageTwo = createTracePage({ items: [], next_cursor: null });
    vi.mocked(traceApi.listTraces).mockResolvedValueOnce(pageOne).mockResolvedValueOnce(pageTwo);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTraces({ agentName: undefined }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toEqual([pageOne]);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    // Pages ACCUMULATE — the first page is never dropped.
    expect(result.current.data?.pages[0]).toEqual(pageOne);
    expect(result.current.data?.pages[1]).toEqual(pageTwo);
    // The second request applies the cursor from page one's next_cursor.
    expect(traceApi.listTraces).toHaveBeenLastCalledWith({
      agentName: undefined,
      cursor: "cursor-2",
    });
  });

  it("has no next page once next_cursor is null", async () => {
    vi.mocked(traceApi.listTraces).mockResolvedValue(createTracePage({ next_cursor: null }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTraces({ agentName: undefined }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
