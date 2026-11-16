import { useQuery } from "@tanstack/react-query";
import type { LlmUsageFilter } from "@/domain/entities/trace/llmUsage";
import { llmUsageApi } from "@/infrastructure/api/trace/llmUsageApi";

/**
 * Global LLM usage aggregates (tokens / cost / duration / runs) for the
 * dashboard KPIs and breakdown charts. Every filter is part of the query
 * key, so changing the agent / period refetches with the new bounds and
 * never leaks a previous window's cache. The filter set is exactly what
 * the backend accepts (`LlmUsageFilter` — agent + window; there is no
 * model filter on the summary, review C3).
 */
export function useTracesUsage(params: LlmUsageFilter = {}) {
  return useQuery({
    queryKey: ["traces", "usage", params.agentName ?? null, params.from ?? null, params.to ?? null],
    queryFn: () => llmUsageApi.getUsageSummary(params),
  });
}
