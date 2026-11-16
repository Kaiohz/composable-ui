import { z } from "zod";

/**
 * One LLM invocation run, as returned inside the
 * `GET /api/v1/traces/usage/top` envelope (backend `LlmUsageRun` + the
 * `TopRunsResponse.items` wrapper; spec: LLM Usage Dashboard —
 * Aggregations §28-§29). A row maps 1:1 to a completed turn whose final
 * AI message carries `metadata.llm_usage`; error runs are counted in the
 * summary errors but never appear here.
 *
 * Clicking a row navigates to the existing read-only
 * `/traces/:threadId` detail.
 *
 * Zod mirror of the backend entity: the wire ALWAYS serialises
 * `turn_id`/`model_name`/`duration_ms` (pydantic-required,
 * `response_model_exclude_none` keeps pydantic defaults) — `.nullable()`
 * accepts the null form at parse time while an absent field is a parse
 * error, so a diverging payload surfaces as a retryable query error
 * instead of a render-time TypeError (review C1/I1). The TypeScript type
 * is derived from the schema (repo convention, see
 * `classicalQueryResponse.ts`); components keep `?? unknown`/`?? null`
 * guards for the tolerated nulls.
 */
export const llmUsageRunSchema = z.object({
  thread_id: z.string().min(1),
  turn_id: z.string().nullable(),
  agent_name: z.string().min(1),
  model_name: z.string().nullable(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  total_tokens: z.number(),
  cost_usd: z.number(),
  duration_ms: z.number().nullable(),
  started_at: z.string().min(1),
  priced: z.boolean().optional(),
});

export type LlmUsageRun = z.infer<typeof llmUsageRunSchema>;

/**
 * The `/usage/top` endpoint wraps the ranked runs in an `{"items": [...]}`
 * envelope (backend `TopRunsResponse`, asserted by the backend behavioral
 * test) — parsing unwraps it to the run array (review C1).
 */
export const llmUsageTopRunsEnvelopeSchema = z
  .object({ items: z.array(llmUsageRunSchema) })
  .transform((envelope) => envelope.items);
