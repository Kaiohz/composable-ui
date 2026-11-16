import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/application/components/ui/select";
import { customRangeIncomplete, type UsagePeriodPreset } from "@/domain/entities/trace/llmUsage";
import type { TracesFilterState } from "@/application/components/trace/tracesFilterState";

/** Radix Select forbids empty values — the shared "no filter" sentinel. */
const ALL_VALUE = "ALL";

interface TracesFiltersProps {
  readonly value: TracesFilterState;
  readonly onChange: (patch: Partial<TracesFilterState>) => void;
  /** Exact agent names from `useAgents` (All option prepended). */
  readonly agentOptions: string[];
  /** Aggregated model names from the usage summary (All option prepended). */
  readonly modelOptions: string[];
}

const FILTER_LABEL = "mb-2 block";

/**
 * Shared filter bar (spec: Frontend §11-§13): exact agent select, optional
 * model select, and the 7-day / 30-day / custom period select. The agent +
 * period controls re-query BOTH backend endpoints (the two routes accept
 * `agent_name`/`from`/`to`); the model control is labeled "Model (runs
 * list)" because the backend accepts no `model_name` — it narrows the
 * fetched top-runs rows client-side via `useTopRuns` (review C3). The
 * custom range uses the existing shadcn/ui `Input` primitive as native date
 * pickers — introducing `react-day-picker` (or any calendar dependency) is
 * forbidden by the design-system gate, so bounds are real inputs styled
 * with existing tokens and validated as pure data (invalid values are
 * dropped by the domain `resolveUsagePeriod`).
 */
export function TracesFilters({
  value,
  onChange,
  agentOptions,
  modelOptions,
}: Readonly<TracesFiltersProps>) {
  const showCustomRange = value.period === "custom";

  return (
    <div
      className="flex flex-wrap items-end gap-4 border border-border bg-surface p-4 block-shadow"
      data-od-id="traces-filters"
    >
      <div>
        <Label htmlFor="traces-agent-filter" className={FILTER_LABEL}>
          Agent
        </Label>
        <Select
          value={value.agentName ?? ALL_VALUE}
          onValueChange={(next) => onChange({ agentName: next === ALL_VALUE ? undefined : next })}
        >
          <SelectTrigger
            id="traces-agent-filter"
            className="w-56"
            data-od-id="traces-filters-agent"
          >
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All agents</SelectItem>
            {agentOptions.map((agentName) => (
              <SelectItem key={agentName} value={agentName}>
                {agentName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        {/*
         * Honest labeling (review C3): the backend aggregation endpoints
         * accept no `model_name`, so this control narrows the RUNS LIST
         * client-side (in `useTopRuns`) — it never re-queries the summary,
         * whose KPIs/charts stay backend-computed for every model.
         */}
        <Label htmlFor="traces-model-filter" className={FILTER_LABEL}>
          Model (runs list)
        </Label>
        <Select
          value={value.modelName ?? ALL_VALUE}
          onValueChange={(next) => onChange({ modelName: next === ALL_VALUE ? undefined : next })}
        >
          <SelectTrigger
            id="traces-model-filter"
            className="w-48"
            data-od-id="traces-filters-model"
          >
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All models</SelectItem>
            {modelOptions.map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="traces-period-filter" className={FILTER_LABEL}>
          Period
        </Label>
        <Select
          value={value.period}
          onValueChange={(next) => onChange({ period: next as UsagePeriodPreset })}
        >
          <SelectTrigger
            id="traces-period-filter"
            className="w-40"
            data-od-id="traces-filters-period"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showCustomRange && (
        <>
          <div>
            <Label htmlFor="traces-from-filter" className={FILTER_LABEL}>
              From
            </Label>
            <Input
              id="traces-from-filter"
              type="date"
              value={value.customFrom}
              onChange={(event) => onChange({ customFrom: event.target.value })}
              className="w-44"
              data-od-id="traces-filters-from"
            />
          </div>
          <div>
            <Label htmlFor="traces-to-filter" className={FILTER_LABEL}>
              To
            </Label>
            <Input
              id="traces-to-filter"
              type="date"
              value={value.customTo}
              onChange={(event) => onChange({ customTo: event.target.value })}
              className="w-44"
              data-od-id="traces-filters-to"
            />
          </div>
          {/* Honest incompleteness marker (BUG-005): until BOTH dates are
              picked the custom range is NOT applied — the bounded 7-day
              window stays active, so an unbounded (all-time) query is never
              issued silently. */}
          {customRangeIncomplete({
            from: value.customFrom || undefined,
            to: value.customTo || undefined,
          }) && (
            <output
              className="w-full font-mono text-xs text-muted"
              data-od-id="traces-filters-range-hint"
            >
              The 7-day window stays active until both dates are picked.
            </output>
          )}
        </>
      )}
    </div>
  );
}

export default TracesFilters;
