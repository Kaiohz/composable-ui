import StatusBadge from "@/application/components/shared/StatusBadge";
import {
  errorRateStatus,
  formatCompactTokens,
  formatCostUsd,
  formatDurationMs,
  formatErrorRate,
  formatTokenCount,
} from "@/application/lib/formatUsage";
import type {
  LlmAgentUsageBreakdown,
  LlmUsageSummary,
} from "@/domain/entities/trace/llmUsageSummary";

interface UsageKpiCardsProps {
  readonly summary: LlmUsageSummary;
}

/** Maximum number of agents shown in the tokens card sub-line. */
const KPI_AGENT_SUBLINE_COUNT = 3;

const KPI_CARD_BASE =
  "flex min-w-0 flex-col gap-2 border border-border bg-surface p-4 block-shadow";
const KPI_LABEL = "font-mono text-xs uppercase tracking-[0.1em] text-muted";
const KPI_VALUE = "font-display text-2xl leading-tight text-fg";
const KPI_SUB = "min-w-0 font-mono text-xs text-muted";

function agentsSubline(byAgent: LlmAgentUsageBreakdown[]): string {
  return [...byAgent]
    .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0))
    .slice(0, KPI_AGENT_SUBLINE_COUNT)
    .map((agent) => `${agent.agent_name} ${formatCompactTokens(agent.total_tokens)}`)
    .join(" · ");
}

/**
 * The dashboard KPI row (spec: Frontend §9) — four cards: total tokens
 * (in / out / total + per-agent sub-line), cost estimate, runs / errors /
 * error rate, median & p95 duration. Presentation only: the numbers come
 * from the backend aggregation, the status colors reuse the StatusBadge
 * `--success/--warn/--danger` token semantics.
 */
export function UsageKpiCards({ summary }: Readonly<UsageKpiCardsProps>) {
  // Backend contract (review C2): `run_count` counts COMPLETED runs and
  // `error_count` counts ERROR runs — the two sets are DISJOINT, not
  // subsets. "Ok" IS run_count, and the error-rate denominator is
  // run_count + error_count (0-safe).
  const completedRuns = summary.run_count ?? 0;
  const errorRuns = summary.error_count ?? 0;
  const totalRuns = completedRuns + errorRuns;
  const unpricedModels = (summary.series?.by_model ?? []).filter((m) => !m.priced);
  const tokensSubline = agentsSubline(summary.series?.by_agent ?? []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-od-id="traces-kpi">
      <section className={KPI_CARD_BASE} data-od-id="traces-kpi-tokens" aria-label="Tokens">
        <p className={KPI_LABEL}>Tokens</p>
        <p className={KPI_VALUE}>{formatTokenCount(summary.total_tokens)}</p>
        <p className={KPI_SUB}>
          <span className="text-accent">IN {formatTokenCount(summary.total_input_tokens)}</span> ·{" "}
          <span className="text-success">OUT {formatTokenCount(summary.total_output_tokens)}</span>
        </p>
        {tokensSubline.length > 0 && (
          <p className={`${KPI_SUB} truncate`} title={tokensSubline}>
            {tokensSubline}
          </p>
        )}
      </section>

      <section className={KPI_CARD_BASE} data-od-id="traces-kpi-cost" aria-label="Cost (USD)">
        <p className={KPI_LABEL}>Cost (USD)</p>
        <p className={KPI_VALUE}>{formatCostUsd(summary.total_cost_usd)}</p>
        <p className={KPI_SUB}>
          {unpricedModels.length > 0 ? (
            <span className="text-warn">
              {unpricedModels.length} unpriced model{unpricedModels.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-success">All models priced</span>
          )}
        </p>
      </section>

      <section className={KPI_CARD_BASE} data-od-id="traces-kpi-runs" aria-label="Runs">
        <p className={KPI_LABEL}>Runs</p>
        <p className={KPI_VALUE}>{formatTokenCount(completedRuns)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={errorRateStatus(errorRuns, totalRuns)}>
            {formatTokenCount(completedRuns)} ok · {formatTokenCount(errorRuns)} errors
          </StatusBadge>
        </div>
        <p className={KPI_SUB}>
          <span className="text-muted">Error rate {formatErrorRate(errorRuns, totalRuns)}</span>
        </p>
      </section>

      <section className={KPI_CARD_BASE} data-od-id="traces-kpi-duration" aria-label="Latency">
        <p className={KPI_LABEL}>Latency</p>
        <p className={KPI_VALUE}>{formatDurationMs(summary.duration_ms_p50)}</p>
        <p className={KPI_SUB}>P95 {formatDurationMs(summary.duration_ms_p95)}</p>
      </section>
    </div>
  );
}

export default UsageKpiCards;
