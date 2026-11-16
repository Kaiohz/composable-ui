/**
 * Spec: prompts-models-crons-traces.md §CRN-003, §CRN-007
 * Cron run hooks: paginated run history (newest first) and Run now must
 * invalidate the run history and the cron list on success.
 *
 * Repo hook-test conventions: external adapter mocked at the network
 * boundary; hooks run with a real QueryClient.
 *
 * Step-1 (Red): the hooks and adapter do not exist yet.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useCronRuns } from "@/application/hooks/cron/useCronRuns";
import { useRunCron } from "@/application/hooks/cron/useRunCron";
import { cronApi } from "@/infrastructure/api/cron/cronApi";
import { createCronRun } from "../../../fixtures/registries";

vi.mock("@/infrastructure/api/cron/cronApi", () => ({
  cronApi: {
    listCrons: vi.fn(),
    createCron: vi.fn(),
    getCron: vi.fn(),
    updateCron: vi.fn(),
    deleteCron: vi.fn(),
    runCron: vi.fn(),
    listRuns: vi.fn(),
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

describe("cron run hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCronRuns fetches bounded run history for a cron id", async () => {
    const runs = [createCronRun()];
    vi.mocked(cronApi.listRuns).mockResolvedValue(runs);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCronRuns("cron-1", { limit: 200 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Backend contract: GET /api/v1/crons/{id}/runs takes `limit` only
    // (1..200); there is no cursor.
    expect(cronApi.listRuns).toHaveBeenCalledWith("cron-1", { limit: 200 });
    expect(result.current.data).toEqual(runs);
  });

  it("useRunCron triggers Run now and invalidates runs + crons", async () => {
    vi.mocked(cronApi.runCron).mockResolvedValue(createCronRun());

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRunCron(), { wrapper });

    act(() => {
      result.current.mutate("cron-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cronApi.runCron).toHaveBeenCalledWith("cron-1");
    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: readonly unknown[] }).queryKey[0],
    );
    expect(invalidatedKeys).toContain("crons");
    expect(invalidatedKeys).toContain("cron-runs");
  });
});
