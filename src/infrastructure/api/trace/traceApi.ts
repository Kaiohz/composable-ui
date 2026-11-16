import type { TraceListParams, TracePage } from "@/domain/entities/trace/traceSummary";
import type { ITracePort } from "@/domain/ports/trace/tracePort";
import { apiClient } from "@/infrastructure/api/axiosInstance";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Axios adapter for the global, server-aggregated trace summaries. */
export const traceApi: ITracePort = {
  async listTraces(params?: TraceListParams): Promise<TracePage> {
    const limit = Math.min(params?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const queryParams: { agent_name?: string; cursor?: string; limit: number } = { limit };
    if (params?.agentName != null) queryParams.agent_name = params.agentName;
    if (params?.cursor != null) queryParams.cursor = params.cursor;
    const response = await apiClient.get<TracePage>("/api/v1/traces", { params: queryParams });
    return response.data;
  },
};
