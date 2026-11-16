import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LlmUsageFilter } from "@/domain/entities/trace/llmUsage";
import type { LlmUsageRun } from "@/domain/entities/trace/llmUsageRun";
import { llmUsageApi } from "@/infrastructure/api/trace/llmUsageApi";

export interface UseTopRunsParams extends LlmUsageFilter {
  /**
   * Client-side model filter for the runs list. The backend
   * `/usage/top` endpoint has no `model_name` parameter (FastAPI would
   * silently ignore it), so the selected model narrows the fetched runs
   * locally instead of implying server support (review C3).
   */
  modelName?: string;
  /** Top-N size; default 10, capped at 100 by the adapter. */
  limit?: number;
}

/**
 * Client-side model narrowing (exact match, no refetch): a run without a
 * model name only survives when no model filter is applied.
 */
function filterRunsByModel(runs: LlmUsageRun[], modelName?: string): LlmUsageRun[] {
  if (modelName == null) return runs;
  return runs.filter((run) => run.model_name === modelName);
}

/**
 * When a model filter is active, the fetched pool widens to the endpoint's
 * cap (BUG-004): with the default top-10 the dropdown could offer models
 * whose runs rank below the fetched page ("No runs match" for a model that
 * HAS runs — and the Dashboard and Runs tabs would disagree). The query
 * key carries the EFFECTIVE limit, so activating/clearing the filter
 * refetches exactly once; toggling between models still re-filters from
 * cache with no request.
 */
const MODEL_FILTER_FETCH_LIMIT = 100;

/**
 * Top-N most expensive runs for the selected window. The filters AND the
 * effective limit participate in the query key: changing either refetches
 * (the model filter deliberately does NOT — see above). The selected
 * `limit` is applied AFTER the client-side model narrowing, so "Top N"
 * stays an honest "top N of the selected model" (pool widened to 100).
 */
export function useTopRuns({ limit, modelName, ...filters }: UseTopRunsParams = {}) {
  const fetchLimit = modelName != null ? MODEL_FILTER_FETCH_LIMIT : limit;
  const query = useQuery({
    queryKey: [
      "traces",
      "usage",
      "top",
      filters.agentName ?? null,
      filters.from ?? null,
      filters.to ?? null,
      fetchLimit ?? null,
    ],
    queryFn: () => llmUsageApi.getTopRuns({ ...filters, limit: fetchLimit }),
  });

  const data = useMemo(() => {
    if (query.data == null) return undefined;
    const filtered = filterRunsByModel(query.data, modelName);
    return limit == null ? filtered : filtered.slice(0, limit);
  }, [query.data, modelName, limit]);

  return { ...query, data };
}
