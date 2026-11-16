import StatusBadge from "@/application/components/shared/StatusBadge";
import { formatCompactTokens } from "@/application/lib/formatUsage";
import type { LlmModelUsageBreakdown } from "@/domain/entities/trace/llmUsageSummary";

interface ModelUsageDonutProps {
  readonly models: LlmModelUsageBreakdown[];
  readonly totalTokens: number;
}

const CHART_PANEL =
  "flex min-w-0 flex-col gap-4 border border-border bg-surface p-4 block-shadow-raised";
const CHART_TITLE = "font-mono text-xs uppercase tracking-[0.1em] text-muted";

/**
 * Donut segment color keys. Only pre-existing design tokens are used; the
 * palette cycles when there are more models than colors (sharp butt caps,
 * no radius, no new colors).
 */
type DonutTokenKey = "accent" | "success" | "warn" | "fg-2" | "danger" | "muted";
const DONUT_PALETTE: readonly DonutTokenKey[] = [
  "accent",
  "success",
  "warn",
  "fg-2",
  "danger",
  "muted",
];

// Static Tailwind literals: dynamic class strings would not be generated.
const DONUT_STROKE: Record<DonutTokenKey, string> = {
  accent: "stroke-accent",
  success: "stroke-success",
  warn: "stroke-warn",
  "fg-2": "stroke-fg-2",
  danger: "stroke-danger",
  muted: "stroke-muted",
};
const DONUT_FILL: Record<DonutTokenKey, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warn: "bg-warn",
  "fg-2": "bg-fg-2",
  danger: "bg-danger",
  muted: "bg-muted",
};

// r = 15.9155 gives a ~100-unit circumference: each share maps 1:1 to
// stroke-dasharray percentage units.
const DONUT_RADIUS = 15.9155;
const DONUT_CENTER = 20;
const DONUT_OFFSET_TOP = 25;

function tokenKeyAt(index: number): DonutTokenKey {
  return DONUT_PALETTE[index % DONUT_PALETTE.length] ?? "accent";
}

/** One donut segment: a model with its token share and dashoffset. */
interface DonutSegment {
  model: LlmModelUsageBreakdown;
  colorKey: DonutTokenKey;
  share: number;
  offset: number;
}

/**
 * Donut chart of tokens by model (spec: Frontend §10) — an inline `<svg>`
 * of `<circle>` segments with `stroke-dasharray` derived from each model's
 * token share of the total. Inline SVG only: no chart library, and only
 * existing color tokens (`--accent`, `--success`, `--warn`, `--danger`,
 * foreground/muted) are stroked. Unpriced models keep the standard
 * `StatusBadge` unpriced marker.
 */
export function ModelUsageDonut({ models, totalTokens }: Readonly<ModelUsageDonutProps>) {
  const safeTotal = totalTokens > 0 ? totalTokens : 1;
  // Linear accumulation (was an array-copying reduce: O(n²) — review I9):
  // each segment's dashoffset continues where the previous one ended
  // (offset_i = 25 - sum(prior shares), mod 100, so the first segment
  // starts at 12 o'clock). No render-scope mutation.
  const segments: DonutSegment[] = [];
  let cumulative = 0;
  for (const [index, model] of models.entries()) {
    const share = ((model.total_tokens ?? 0) / safeTotal) * 100;
    if (share <= 0) continue;
    const offset = (((DONUT_OFFSET_TOP - cumulative) % 100) + 100) % 100;
    segments.push({ model, colorKey: tokenKeyAt(index), share, offset });
    cumulative += share;
  }

  return (
    <div className={CHART_PANEL} data-od-id="traces-charts-model">
      <h3 className={CHART_TITLE}>Tokens by model</h3>
      {segments.length === 0 ? (
        <p className="font-body text-xs text-muted">No model usage in the selected period.</p>
      ) : (
        <figure
          className="flex flex-wrap items-center gap-6"
          aria-label={`Tokens by model: ${segments
            .map((segment) => `${segment.model.model_name} ${Math.round(segment.share)}%`)
            .join(", ")}`}
        >
          {/* Native <figure> carries the chart's accessible description
              (Sonar S6819): the figure's aria-label names the segments for
              screen readers, so the svg is purely visual (aria-hidden).
              Tailwind v4 preflight zeroes figure margins (`* { margin: 0 }`)
              — no visual drift. */}
          <svg viewBox="0 0 40 40" className="h-32 w-32 shrink-0" aria-hidden="true">
            {/* Track ring (border-soft token) so an empty share still reads as a donut hole. */}
            <circle
              cx={DONUT_CENTER}
              cy={DONUT_CENTER}
              r={DONUT_RADIUS}
              fill="none"
              strokeWidth={5}
              className="stroke-border-soft"
            />
            {segments.map((segment) => (
              <circle
                key={segment.model.model_name}
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
                fill="none"
                strokeWidth={5}
                strokeDasharray={`${segment.share} ${100 - segment.share}`}
                strokeDashoffset={segment.offset}
                className={DONUT_STROKE[segment.colorKey]}
              />
            ))}
            <text
              x={DONUT_CENTER}
              y={DONUT_CENTER + 1.5}
              textAnchor="middle"
              fontSize="5"
              className="fill-fg font-mono"
            >
              {formatCompactTokens(totalTokens)}
            </text>
          </svg>

          <ul className="flex min-w-0 flex-1 flex-col gap-2">
            {segments.map((segment) => (
              <li
                key={segment.model.model_name}
                className="flex min-w-0 items-center gap-2 font-mono text-xs text-muted"
              >
                <span
                  className={`h-2 w-2 shrink-0 ${DONUT_FILL[segment.colorKey]}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate text-fg-2" title={segment.model.model_name}>
                  {segment.model.model_name}
                </span>
                {!segment.model.priced && <StatusBadge status="unpriced" className="shrink-0" />}
                <span className="ml-auto shrink-0">
                  {formatCompactTokens(segment.model.total_tokens)} · {Math.round(segment.share)}%
                </span>
              </li>
            ))}
          </ul>
        </figure>
      )}
    </div>
  );
}

export default ModelUsageDonut;
