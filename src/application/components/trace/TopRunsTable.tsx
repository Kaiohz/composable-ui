import { Link } from "react-router-dom";
import {
  formatCompactTokens,
  formatCostUsd,
  formatDateTime,
  formatDurationMs,
  shortThreadId,
} from "@/application/lib/formatUsage";
import type { LlmUsageRun } from "@/domain/entities/trace/llmUsageRun";

interface TopRunsTableProps {
  readonly runs: LlmUsageRun[];
  /**
   * TRUE while the "Model (runs list)" filter is active. The client-side
   * narrowing can then legitimately leave zero rows even for a model that
   * HAS runs (they may rank below the fetched top-100 pool — BUG-004), so
   * the no-results copy states the real reason instead of implying the
   * model produced no runs.
   */
  readonly modelFilterActive?: boolean;
}

const TABLE_HEADER_CELL =
  "px-2 py-1 font-mono text-xs uppercase tracking-[0.1em] text-muted font-normal";

/** Shared grid template so header and rows stay aligned on md+ screens. */
const RUN_GRID =
  "grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)]";

function RunCells({ run }: Readonly<{ run: LlmUsageRun }>) {
  return (
    <>
      <span className="min-w-0 truncate">
        <span className="text-fg">{run.agent_name}</span>{" "}
        <span className="text-muted">#{shortThreadId(run.thread_id)}</span>
      </span>
      <span className="min-w-0 truncate text-fg-2">{run.model_name ?? "unknown"}</span>
      <span className="text-fg-2">{formatCompactTokens(run.total_tokens)}</span>
      <span className="text-accent">{formatCostUsd(run.cost_usd)}</span>
      <span className="text-fg-2">{formatDurationMs(run.duration_ms)}</span>
      <span className="text-muted">{formatDateTime(run.started_at)}</span>
    </>
  );
}

/**
 * Top-N most expensive runs (spec: Frontend §10). Each row is a native
 * anchor to the existing read-only `/traces/:threadId` detail — click and
 * keyboard Enter navigate, and the accessible name is the row content
 * (same Sonar-safe pattern as the threads list rows).
 */
export function TopRunsTable({ runs, modelFilterActive }: Readonly<TopRunsTableProps>) {
  return (
    <div
      className="flex min-w-0 flex-col gap-3 border border-border bg-surface p-4 block-shadow-raised"
      data-od-id="traces-top-runs"
    >
      <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Top runs by cost</h3>
      {runs.length === 0 ? (
        <p className="font-body text-xs text-muted">
          {modelFilterActive
            ? "No runs from the selected model in the fetched top 100 of this window — they may rank lower. Clear the model filter or adjust the period."
            : "No runs match the selected filters."}
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          {/* Header row is presentational: the links below are the accessible grid. */}
          <div
            className={`${RUN_GRID} hidden gap-x-4 gap-y-1 border-b border-border px-2 pb-2 md:grid`}
            aria-hidden="true"
          >
            <span className={TABLE_HEADER_CELL}>Run</span>
            <span className={TABLE_HEADER_CELL}>Model</span>
            <span className={TABLE_HEADER_CELL}>Tokens</span>
            <span className={TABLE_HEADER_CELL}>Cost</span>
            <span className={TABLE_HEADER_CELL}>Duration</span>
            <span className={TABLE_HEADER_CELL}>Started</span>
          </div>
          {runs.map((run) => (
            <Link
              // Index-independent composite key: two legacy runs of the same
              // thread can both have `turn_id == null`, so the start
              // timestamp disambiguates (review I7).
              key={`${run.thread_id}-${run.turn_id ?? "0"}-${run.started_at}`}
              to={`/traces/${run.thread_id}`}
              data-od-id="traces-top-runs-row"
              className={`${RUN_GRID} cursor-pointer items-baseline border border-transparent px-2 py-2 transition-[background-color,border-color] duration-fast ease-standard hover:bg-surface-warm hover:border-border focus-visible:outline-none focus-visible:shadow-focus`}
            >
              <RunCells run={run} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default TopRunsTable;
