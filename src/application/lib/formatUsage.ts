/**
 * Pure formatters for the LLM usage dashboard KPIs (spec: LLM Usage
 * Dashboard — Frontend §9). Values come from the backend aggregation; only
 * presentation happens here. Mirrors the conventions of
 * `formatFileSize.ts` (null/invalid-safe).
 */

/** Hoisted: `Intl.NumberFormat` construction is expensive and identical
 * for every call — allocate once at module scope, reuse across renders. */
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US");

/** Decimal widths tried for sub-cent costs until a non-zero digit shows. */
const SUB_CENT_PRECISIONS = [4, 5, 6, 7, 8] as const;

/** Formats a millisecond duration: sub-second as ms, otherwise seconds. */
export function formatDurationMs(durationMs: number | null | undefined): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return "—";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

/** Exact token count with thousands separators (KPI main values). */
export function formatTokenCount(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens)) return "0";
  return INTEGER_FORMATTER.format(Math.round(tokens));
}

/** Compact token count for chart rows and per-agent sub-lines. */
export function formatCompactTokens(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens)) return "0";
  const rounded = Math.round(tokens);
  const trimZero = (value: string) => value.replace(/\.0$/, "");
  if (rounded >= 1_000_000) return `${trimZero((rounded / 1_000_000).toFixed(1))}M`;
  if (rounded >= 1_000) return `${trimZero((rounded / 1000).toFixed(1))}k`;
  return INTEGER_FORMATTER.format(rounded);
}

/**
 * USD cost estimate with adaptive precision. Sub-cent values keep enough
 * decimals to stay visibly non-zero: `toFixed(4)` rendered a $0.0000125
 * run as "$0.0000" — visually identical to a free/unpriced run while the
 * card claimed "All models priced" (BUG-001). Exact zero (and missing
 * values) stay "$0.00"; larger values keep the 2-decimal form.
 */
export function formatCostUsd(cost: number | null | undefined): string {
  if (cost == null || !Number.isFinite(cost) || cost === 0) return "$0.00";
  if (Math.abs(cost) >= 0.01) return `$${cost.toFixed(2)}`;
  // Sub-cent: widen the precision just past the zero-run of decimals so
  // the first significant digit is visible — e.g. 1.25e-05 → "$0.00001".
  for (const decimals of SUB_CENT_PRECISIONS) {
    const rendered = cost.toFixed(decimals);
    if (rendered.replace(/[-.0]/g, "") !== "") return `$${rendered}`;
  }
  return `$${cost.toFixed(SUB_CENT_PRECISIONS.at(-1) ?? 8)}`;
}

/**
 * Error rate as a percentage of ALL runs. Backend contract: `run_count`
 * counts COMPLETED runs and `error_count` counts ERROR runs — disjoint
 * sets — so the denominator is `completed + error`, never `run_count`
 * alone (review C2). No runs means no rate ("—").
 */
export function formatErrorRate(errorCount: number, totalRunCount: number): string {
  if (totalRunCount <= 0) return "—";
  return `${((errorCount / totalRunCount) * 100).toFixed(1)}%`;
}

/** Severity token for the error rate, from the StatusBadge semantics. */
export function errorRateStatus(
  errorCount: number,
  totalRunCount: number,
): "success" | "warn" | "danger" {
  if (totalRunCount <= 0 || errorCount <= 0) return "success";
  const errorRate = errorCount / totalRunCount;
  if (errorRate >= 0.1) return "danger";
  return "warn";
}

const SHORT_ID_LENGTH = 8;

/** Compact thread id for table cells and sub-lines (shared by the run table and the thread list). */
export function shortThreadId(threadId: string): string {
  return threadId.slice(0, SHORT_ID_LENGTH);
}

/** Hoisted: `Intl.DateTimeFormat` was previously allocated per rendered row. */
const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Short "Mon d, HH:MM" stamp for run/thread rows ("—" when missing). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return DATETIME_FORMATTER.format(new Date(value));
}
