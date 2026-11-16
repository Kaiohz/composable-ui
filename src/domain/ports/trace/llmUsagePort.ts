import type { LlmUsageFilter, LlmUsageRunFilter } from "@/domain/entities/trace/llmUsage";
import type { LlmUsageSummary } from "@/domain/entities/trace/llmUsageSummary";
import type { LlmUsageRun } from "@/domain/entities/trace/llmUsageRun";

/**
 * Port for the aggregated LLM usage observability endpoints (spec: LLM
 * Usage Dashboard — Aggregations §26-§30). RLS isolation is enforced
 * server-side; the port carries only filters.
 */
export interface ILlmUsagePort {
  /** Global token/cost/duration aggregates + per-agent/per-model series. */
  getUsageSummary(params?: LlmUsageFilter): Promise<LlmUsageSummary>;
  /** Top-N most expensive runs for the selected window. */
  getTopRuns(params?: LlmUsageRunFilter): Promise<LlmUsageRun[]>;
}
