import { useInfiniteQuery } from "@tanstack/react-query";
import { traceApi } from "@/infrastructure/api/trace/traceApi";

export interface UseTracesParams {
  /** Exact (case-sensitive) agent name filter. */
  agentName?: string;
  /** Page size; default 50, capped at 100. */
  limit?: number;
}

/**
 * Global trace summaries with an exact agent filter, paginated with
 * `useInfiniteQuery` so consecutive pages ACCUMULATE (`Load more` appends
 * rows instead of replacing the loaded page, spec §TRC-004). The agent
 * filter participates in the query key, so changing the filter resets the
 * pagination to page one and the cursor never leaks across filters.
 */
export function useTraces({ agentName, limit }: UseTracesParams = {}) {
  return useInfiniteQuery({
    queryKey: ["traces", agentName ?? null, limit ?? null],
    queryFn: ({ pageParam }) => traceApi.listTraces({ agentName, cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}
