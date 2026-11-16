/**
 * LLM usage query parameters and period-window resolution (spec: LLM Usage
 * Dashboard on /traces — Metrics §1-§3, Frontend §11-§13).
 *
 * The backend aggregates tokens/cost/duration server-side from
 * `trace_events.metadata.llm_usage`; the frontend only carries the filters
 * that select the window: an exact (case-sensitive) agent name, an optional
 * model name, and an ISO `from`/`to` period.
 */

/** Number of milliseconds in one UTC day. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Aggregation window presets offered by the dashboard period filter. */
export type UsagePeriodPreset = "7d" | "30d" | "custom";

/** Custom bounds picked in the date inputs (`yyyy-mm-dd`, inclusive). */
export interface CustomUsageRange {
  from?: string;
  to?: string;
}

/**
 * Resolved ISO-8601 bounds forwarded to `/api/v1/traces/usage[...]`.
 * Any bound may be absent: missing `to` means "up to now".
 */
export interface UsageWindow {
  from?: string;
  to?: string;
}

/**
 * Filters shared by both usage aggregation endpoints. Only parameters the
 * backend actually accepts live here: the `/usage` and `/usage/top` routes
 * take `agent_name`, `from` and `to` — there is NO `model_name` (FastAPI
 * would silently ignore it), so the model filter of the runs list is
 * applied client-side in `useTopRuns` (review C3).
 */
export interface LlmUsageFilter {
  /** Exact (case-sensitive) agent name, or undefined for all agents. */
  agentName?: string;
  /** ISO-8601 lower bound (inclusive). */
  from?: string;
  /** ISO-8601 upper bound. */
  to?: string;
}

/** Filters plus the top-N size for the most expensive runs endpoint. */
export interface LlmUsageRunFilter extends LlmUsageFilter {
  /** Top-N runs to return; default 10, hard cap 100. */
  limit?: number;
}

function safeIso(date: Date): string | undefined {
  const time = date.getTime();
  if (!Number.isFinite(time)) return undefined;
  return new Date(time).toISOString();
}

export function usageWindowFromCustom(range: CustomUsageRange): UsageWindow {
  if (!range.from && !range.to) return {};
  return {
    // A date input yields `yyyy-mm-dd`; the bounds cover the whole UTC day
    // so a run started any time on `from`/`to` is included.
    from: range.from ? safeIso(new Date(`${range.from}T00:00:00.000Z`)) : undefined,
    to: range.to ? safeIso(new Date(`${range.to}T23:59:59.999Z`)) : undefined,
  };
}

/**
 * TRUE until BOTH custom bounds are picked. A half-picked (or unpicked)
 * custom range is incomplete: applying it would either aggregate the
 * user's whole history (empty range → unbounded query, BUG-005) or read
 * as a bound the user did not confirm. The UI marks the state with a hint
 * (`TracesFilters`), and the window falls back to the 7-day preset.
 */
export function customRangeIncomplete(range: CustomUsageRange): boolean {
  return !range.from || !range.to;
}

/** The 7-day fallback window (open-ended, ending "now"). */
function sevenDayWindow(now: Date): UsageWindow {
  return { from: safeIso(new Date(now.getTime() - 7 * DAY_MS)) ?? undefined };
}

/**
 * Pure resolution of the period filter into ISO bounds (backend contract:
 * `?from=<iso>&to=<iso>`). Presets are open-ended windows ending "now"
 * (no `to` bound). A custom range only takes over once BOTH bounds are
 * picked — until then the 7-day preset stays active, because applying an
 * incomplete custom range would issue an unbounded (all-time) query
 * silently (BUG-005).
 */
export function resolveUsagePeriod(
  preset: UsagePeriodPreset,
  custom: CustomUsageRange = {},
  now: Date = new Date(),
): UsageWindow {
  if (preset === "7d") {
    return sevenDayWindow(now);
  }
  if (preset === "30d") {
    return { from: safeIso(new Date(now.getTime() - 30 * DAY_MS)) ?? undefined };
  }
  return customRangeIncomplete(custom) ? sevenDayWindow(now) : usageWindowFromCustom(custom);
}
