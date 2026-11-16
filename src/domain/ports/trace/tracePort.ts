import type { TraceListParams, TracePage } from "@/domain/entities/trace/traceSummary";

/** Port for the global, read-only trace browser (spec §TRC-001). */
export interface ITracePort {
  listTraces(params?: TraceListParams): Promise<TracePage>;
}
