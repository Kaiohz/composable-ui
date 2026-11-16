import { z } from "zod";

/**
 * Backend aggregation response for `GET /api/v1/traces/usage` (spec: LLM
 * Usage Dashboard — Aggregations §27). All numbers are server-computed
 * across `trace_events.metadata.llm_usage` joins with the `llm_prices`
 * table; the frontend renders them verbatim. The TypeScript types are
 * derived from the schemas (repo convention, see
 * `classicalQueryResponse.ts`); a payload that diverges from them
 * surfaces at parse time as a retryable query error instead of a render
 * crash (review C1/I1).
 */

/** Per-agent token/cost breakdown (backend `LlmUsageAgentBreakdown`). */
export const llmAgentUsageSchema = z.object({
  agent_name: z.string().min(1),
  // The backend always serialises these (pydantic defaults are kept by
  // response_model_exclude_none — only None members are dropped).
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
  cost_usd: z.number(),
  priced: z.boolean(),
  // The backend agent breakdown sends no run counts today (review I5) —
  // tolerated when present, optional on the wire.
  run_count: z.number().optional(),
});

export type LlmAgentUsageBreakdown = z.infer<typeof llmAgentUsageSchema>;

/**
 * Per-model token/cost breakdown (backend `LlmUsageModelBreakdown`). A
 * model without a `llm_prices` row is reported with `cost_usd = 0` and
 * `priced = false` (spec §17) — usage still shows, only the cost estimate
 * is known to be unknown.
 */
export const llmModelUsageSchema = z.object({
  model_name: z.string().min(1),
  // The backend model breakdown has no provider field today; tolerate a
  // future addition instead of failing on it.
  provider: z.string().nullish(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
  cost_usd: z.number(),
  priced: z.boolean(),
});

export type LlmModelUsageBreakdown = z.infer<typeof llmModelUsageSchema>;

/**
 * The two breakdown series the dashboard charts render (backend
 * `UsageSeries`, both members present for this client's requests — it
 * never sends `group_by`).
 */
export const llmUsageSeriesSchema = z.object({
  by_agent: z.array(llmAgentUsageSchema),
  by_model: z.array(llmModelUsageSchema),
});

export type LlmUsageSeries = z.infer<typeof llmUsageSeriesSchema>;

/** Global totals for the selected window, plus the breakdown series. */
export const llmUsageSummarySchema = z.object({
  total_input_tokens: z.number(),
  total_output_tokens: z.number(),
  total_tokens: z.number(),
  total_cost_usd: z.number(),
  /** COMPLETED runs (turns with a terminal AI_MESSAGE). */
  run_count: z.number(),
  /** ERROR runs (turns missing the terminal AI_MESSAGE) — disjoint from run_count. */
  error_count: z.number(),
  /** Median / p95 duration in ms; null when no completed run. */
  duration_ms_p50: z.number().nullable(),
  duration_ms_p95: z.number().nullable(),
  series: llmUsageSeriesSchema,
});

export type LlmUsageSummary = z.infer<typeof llmUsageSummarySchema>;
