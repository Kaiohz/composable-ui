import { z } from "zod";
import type { LlmUsageFilter, LlmUsageRunFilter } from "@/domain/entities/trace/llmUsage";
import type { ILlmUsagePort } from "@/domain/ports/trace/llmUsagePort";
import type { LlmUsageSummary } from "@/domain/entities/trace/llmUsageSummary";
import type { LlmUsageRun } from "@/domain/entities/trace/llmUsageRun";
import { llmUsageSummarySchema } from "@/domain/entities/trace/llmUsageSummary";
import { llmUsageTopRunsEnvelopeSchema } from "@/domain/entities/trace/llmUsageRun";
import { apiClient } from "@/infrastructure/api/axiosInstance";

const DEFAULT_TOP_LIMIT = 10;
const MAX_TOP_LIMIT = 100;

/**
 * Query parameters the backend ACCEPTS (contract check:
 * `composable-agents/src/application/routes/traces.py`): `agent_name`,
 * `from`, `to` — and `limit` on the top endpoint only. There is NO
 * `model_name`: FastAPI would silently ignore it while the UI implied
 * server-side filtering (review C3) — the model filter is client-side in
 * `useTopRuns` instead.
 */
function usageQueryParams(params: LlmUsageFilter): Record<string, string> {
  const queryParams: Record<string, string> = {};
  if (params.agentName != null) queryParams.agent_name = params.agentName;
  if (params.from != null) queryParams.from = params.from;
  if (params.to != null) queryParams.to = params.to;
  return queryParams;
}

/**
 * The API answered a payload this frontend cannot parse. `ErrorRow`
 * renders `error.message`: keep it a short, human sentence the user can
 * act on, never the raw Zod issue list (which is a JSON blob — BUG-003).
 * The technical detail stays non-user-facing on `Error.cause` (console /
 * debugging only).
 */
function payloadError(label: string, error: z.ZodError): Error {
  return new Error(`Usage data format unexpected — retry or adjust filters (${label})`, {
    cause: error,
  });
}

/**
 * Axios adapter implementing `ILlmUsagePort` against the aggregated
 * observability endpoints (spec: LLM Usage Dashboard — Aggregations).
 * Every response is parsed against the Zod domain schemas before it is
 * returned: a contract drift surfaces as a handled query error (retryable
 * UI), never as a render-time TypeError (review C1/I1) or a raw
 * validation dump (BUG-003). RLS per-user isolation is enforced
 * server-side.
 */
export const llmUsageApi: ILlmUsagePort = {
  async getUsageSummary(params?: LlmUsageFilter): Promise<LlmUsageSummary> {
    const response = await apiClient.get("/api/v1/traces/usage", {
      params: usageQueryParams(params ?? {}),
    });
    const result = llmUsageSummarySchema.safeParse(response.data);
    if (!result.success) throw payloadError("usage summary", result.error);
    return result.data;
  },

  /**
   * The backend wraps the ranked runs in an `{"items": [...]}` envelope
   * (`TopRunsResponse`) — the parse unwraps it to the run array.
   */
  async getTopRuns(params?: LlmUsageRunFilter): Promise<LlmUsageRun[]> {
    const limit = Math.min(params?.limit ?? DEFAULT_TOP_LIMIT, MAX_TOP_LIMIT);
    const response = await apiClient.get("/api/v1/traces/usage/top", {
      params: { ...usageQueryParams(params ?? {}), limit },
    });
    const result = llmUsageTopRunsEnvelopeSchema.safeParse(response.data);
    if (!result.success) throw payloadError("top runs", result.error);
    return result.data;
  },
};
