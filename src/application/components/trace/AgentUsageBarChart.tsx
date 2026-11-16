import { formatCompactTokens } from "@/application/lib/formatUsage";
import type { LlmAgentUsageBreakdown } from "@/domain/entities/trace/llmUsageSummary";

interface AgentUsageBarChartProps {
  readonly agents: LlmAgentUsageBreakdown[];
}

/** Panel shell shared by both breakdown charts (Tetris card look). */
const CHART_PANEL =
  "flex min-w-0 flex-col gap-4 border border-border bg-surface p-4 block-shadow-raised";
const CHART_TITLE = "font-mono text-xs uppercase tracking-[0.1em] text-muted";
const LEGEND_SWATCH = "inline-block h-2 w-2 shrink-0";

/**
 * Horizontal bar chart of tokens by agent (spec: Frontend §10) — stacked
 * input/output segments drawn with absolutely-positioned divs inside a
 * relative flex track, using the `--accent` (input) and `--success`
 * (output) tokens only. Bars scale against the largest agent in the
 * series; no chart library, no colors outside the existing tokens.
 */
export function AgentUsageBarChart({ agents }: Readonly<AgentUsageBarChartProps>) {
  // Largest agent anchors the scale: 0 tokens everywhere still yields
  // full-width-safe percentages (avoid a 0/0 division).
  const maxTotal = Math.max(...agents.map((agent) => agent.total_tokens ?? 0), 1);

  return (
    <div className={CHART_PANEL} data-od-id="traces-charts-agent">
      <h3 className={CHART_TITLE}>Tokens by agent</h3>
      {agents.length === 0 ? (
        <p className="font-body text-xs text-muted">No agent usage in the selected period.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {agents.map((agent) => {
            const inputTokens = agent.input_tokens ?? 0;
            const outputTokens = agent.output_tokens ?? 0;
            const totalTokens = agent.total_tokens ?? inputTokens + outputTokens;
            const safeTotal = totalTokens > 0 ? totalTokens : 1;
            const inputPercent = totalTokens > 0 ? (inputTokens / safeTotal) * 100 : 0;
            const outputPercent = totalTokens > 0 ? (outputTokens / safeTotal) * 100 : 0;
            const widthPercent = (totalTokens / maxTotal) * 100;

            return (
              <div key={agent.agent_name} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
                  <span className="min-w-0 truncate text-fg-2" title={agent.agent_name}>
                    {agent.agent_name}
                  </span>
                  <span className="shrink-0 text-muted">{formatCompactTokens(totalTokens)}</span>
                </div>
                <div
                  role="img"
                  aria-label={`${agent.agent_name}: ${formatCompactTokens(inputTokens)} input tokens, ${formatCompactTokens(outputTokens)} output tokens`}
                  className="relative flex h-4 w-full overflow-hidden border border-border bg-surface-warm"
                  style={{ width: `${Math.max(widthPercent, 0)}%` }}
                >
                  {/* Absolutely-positioned stacked segments (input first). */}
                  <div
                    className="absolute inset-y-0 left-0 bg-accent"
                    style={{ width: `${inputPercent}%` }}
                  />
                  <div
                    className="absolute inset-y-0 bg-success"
                    style={{ left: `${inputPercent}%`, width: `${outputPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className={`${LEGEND_SWATCH} bg-accent`} aria-hidden="true" /> Input
            </span>
            <span className="flex items-center gap-2">
              <span className={`${LEGEND_SWATCH} bg-success`} aria-hidden="true" /> Output
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentUsageBarChart;
