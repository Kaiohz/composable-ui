/**
 * Shared filter-bar state for the LLM usage dashboard (spec: Frontend
 * §11-§13). Kept out of `TracesFilters.tsx` so that component file stays a
 * component-only export (react-refresh/only-export-components).
 */
import type { UsagePeriodPreset } from "@/domain/entities/trace/llmUsage";

/** Filter state owned by the dashboard page, shared by Dashboard and Runs tabs. */
export interface TracesFilterState {
  /** Exact agent name or undefined for all agents. */
  agentName?: string;
  /** Exact model name or undefined for all models. */
  modelName?: string;
  /** Aggregation window preset. */
  period: UsagePeriodPreset;
  /** Custom lower bound `yyyy-mm-dd` (used when period is "custom"). */
  customFrom: string;
  /** Custom upper bound `yyyy-mm-dd` (used when period is "custom"). */
  customTo: string;
}

/** Default view: last 7 days, all agents, all models. */
export const DEFAULT_TRACES_FILTER: TracesFilterState = {
  agentName: undefined,
  modelName: undefined,
  period: "7d",
  customFrom: "",
  customTo: "",
};
