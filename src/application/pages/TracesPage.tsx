import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Waypoints } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import MessageList from "@/application/components/chat/MessageList";
import ThreadSourceBadge from "@/application/components/shared/ThreadSourceBadge";
import AgentUsageBarChart from "@/application/components/trace/AgentUsageBarChart";
import ModelUsageDonut from "@/application/components/trace/ModelUsageDonut";
import TopRunsTable from "@/application/components/trace/TopRunsTable";
import TracesFilters from "@/application/components/trace/TracesFilters";
import {
  DEFAULT_TRACES_FILTER,
  type TracesFilterState,
} from "@/application/components/trace/tracesFilterState";
import UsageKpiCards from "@/application/components/trace/UsageKpiCards";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/application/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/application/components/ui/tabs";
import { useAgents } from "@/application/hooks/agent/useAgents";
import { useThreadHistory } from "@/application/hooks/chat/useThreadHistory";
import { useTopRuns } from "@/application/hooks/trace/useTopRuns";
import { useTraces } from "@/application/hooks/trace/useTraces";
import { useTracesUsage } from "@/application/hooks/trace/useTracesUsage";
import type { LlmUsageFilter } from "@/domain/entities/trace/llmUsage";
import { resolveUsagePeriod } from "@/domain/entities/trace/llmUsage";
import type { TraceSummary } from "@/domain/entities/trace/traceSummary";
import { formatDateTime, shortThreadId } from "@/application/lib/formatUsage";

const FILTER_DEBOUNCE_MS = 250;

/** Dashboard tab shows the N most expensive runs. */
const DASHBOARD_TOP_RUNS_LIMIT = 10;
/** Runs tab default limit; the control switches between these sizes. */
const RUNS_LIMIT_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_RUNS_LIMIT = 25;

export default function TracesPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  if (threadId) {
    return <TraceDetail threadId={threadId} />;
  }
  return <TraceDashboard />;
}

function LoadingRow({ label, odId }: Readonly<{ label: string; odId: string }>) {
  return (
    <div
      className="flex items-center justify-center gap-2 p-8"
      aria-busy="true"
      aria-live="polite"
      data-od-id={odId}
    >
      <span
        className="spin inline-block h-4 w-4 border-2 border-accent border-t-transparent"
        aria-hidden="true"
      />
      <span className="font-mono text-xs text-muted">{label}</span>
    </div>
  );
}

function ErrorRow({
  message,
  odId,
  onRetry,
}: Readonly<{ message: string; odId: string; onRetry: () => void }>) {
  return (
    <div
      role="alert"
      data-od-id={odId}
      className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-4"
    >
      <p className="font-mono text-xs text-danger">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/**
 * `/traces` as the LLM usage dashboard (spec: Frontend §8, §15): three
 * tabs backed by the shared shadcn Tabs primitive. Dashboard (default)
 * renders the KPI row + breakdown charts + top runs; Runs reuses the top
 * runs table with a limit control; Threads keeps the EXACT existing
 * per-thread history. All tabs share the exact agent / model / period
 * filters, which re-query both usage endpoints via the query keys.
 */
function TraceDashboard() {
  const [filter, setFilter] = useState<TracesFilterState>(DEFAULT_TRACES_FILTER);
  const updateFilter = useCallback((patch: Partial<TracesFilterState>) => {
    setFilter((previous) => ({ ...previous, ...patch }));
  }, []);

  const agentsQuery = useAgents();
  const agentOptions = useMemo(
    () => (agentsQuery.data ?? []).map((agent) => agent.name),
    [agentsQuery.data],
  );

  const usageWindow = useMemo(
    () =>
      resolveUsagePeriod(filter.period, {
        from: filter.customFrom || undefined,
        to: filter.customTo || undefined,
      }),
    [filter.period, filter.customFrom, filter.customTo],
  );
  /**
   * Server-side filters (exact agent + window) — exactly what the
   * `/usage` endpoint accepts. The model filter is deliberately NOT
   * forwarded: the endpoint has no `model_name`, so the summary stays
   * backend-computed for every model (review C3).
   */
  const usageFilter = useMemo<LlmUsageFilter>(
    () => ({
      agentName: filter.agentName,
      from: usageWindow.from,
      to: usageWindow.to,
    }),
    [filter.agentName, usageWindow],
  );

  // One usage summary feeds both tabs (KPIs on Dashboard, model options on
  // both) — changing the filters re-queries it through the query key.
  const usage = useTracesUsage(usageFilter);
  /**
   * Model options source (review I3): the summary's by-model series. The
   * server never narrows the summary by model (no `model_name` on
   * `/usage`), so this list stays the COMPLETE model set regardless of the
   * selected model — the dropdown can never collapse to a single entry.
   */
  const modelOptions = useMemo(
    () => (usage.data?.series?.by_model ?? []).map((model) => model.model_name),
    [usage.data],
  );

  return (
    <AppShell>
      <div
        className="traces-view flex flex-1 flex-col gap-6 overflow-y-auto bg-bg p-4 md:p-8"
        data-od-id="traces-view"
      >
        <p className="max-w-md font-body text-sm text-muted">
          Token, cost and duration usage across all threads. The exact agent filter and period apply
          to the Dashboard and Runs tabs; the model filter narrows the runs list.
        </p>

        <Tabs defaultValue="dashboard" className="flex min-w-0 flex-1 flex-col gap-6">
          <TabsList aria-label="Traces views">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="threads">Threads</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="flex min-w-0 flex-col gap-6">
            <DashboardTab
              filter={filter}
              updateFilter={updateFilter}
              agentOptions={agentOptions}
              modelOptions={modelOptions}
              usageFilter={usageFilter}
              usage={usage}
            />
          </TabsContent>

          <TabsContent value="runs" className="flex min-w-0 flex-col gap-6">
            <RunsTab
              filter={filter}
              updateFilter={updateFilter}
              agentOptions={agentOptions}
              modelOptions={modelOptions}
              usageFilter={usageFilter}
            />
          </TabsContent>

          <TabsContent value="threads" className="flex min-w-0 flex-1 flex-col gap-6">
            <TraceList />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

interface TabSharedProps {
  readonly filter: TracesFilterState;
  readonly updateFilter: (patch: Partial<TracesFilterState>) => void;
  readonly agentOptions: string[];
  readonly modelOptions: string[];
  readonly usageFilter: LlmUsageFilter;
}

/**
 *
 * Top-N runs section (spec: Frontend §10): loading / error / no-results
 * states plus the table whose rows navigate to the read-only thread
 * detail. Used by the Dashboard tab (fixed top-10) and the Runs tab
 * (limit control). The model filter narrows the FETCHED rows client-side
 * inside `useTopRuns` (with the fetch pool widened to the cap — BUG-004)
 */
function TopRunsSection({
  usageFilter,
  modelName,
  limit,
}: Readonly<{
  usageFilter: LlmUsageFilter;
  modelName?: string;
  limit?: number;
}>) {
  const {
    data: runs,
    isLoading,
    isError,
    error,
    refetch,
  } = useTopRuns({
    ...usageFilter,
    modelName,
    limit,
  });

  return (
    <div className="flex min-w-0 flex-col gap-3" data-od-id="traces-top-runs-section">
      {isLoading && <LoadingRow label="Loading runs…" odId="traces-runs-loading" />}
      {isError && (
        <ErrorRow
          message={error instanceof Error ? error.message : "Request failed"}
          odId="traces-runs-error"
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !isError && (
        <TopRunsTable runs={runs ?? []} modelFilterActive={modelName != null} />
      )}
    </div>
  );
}

function DashboardTab({
  filter,
  updateFilter,
  agentOptions,
  modelOptions,
  usageFilter,
  usage,
}: Readonly<TabSharedProps & { usage: ReturnType<typeof useTracesUsage> }>) {
  const { data: summary, isLoading, isError, error, refetch } = usage;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <TracesFilters
        value={filter}
        onChange={updateFilter}
        agentOptions={agentOptions}
        modelOptions={modelOptions}
      />

      {isLoading && <LoadingRow label="Loading usage…" odId="traces-usage-loading" />}

      {isError && (
        <ErrorRow
          message={error instanceof Error ? error.message : "Request failed"}
          odId="traces-usage-error"
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading &&
        !isError &&
        summary &&
        // A window without any run AT ALL (completed AND error) shows an
        // explicit empty state rather than zeroed KPI cards. An error-only
        // window is NOT empty: `run_count` counts completed runs, so it can
        // be 0 while errors exist — they must stay visible (review C2,
        // "Error runs must be counted").
        (summary.run_count === 0 &&
        (summary.error_count ?? 0) === 0 &&
        (summary.total_tokens ?? 0) === 0 ? (
          <div
            data-od-id="traces-usage-empty"
            className="flex flex-col items-center justify-center gap-4 border border-border bg-surface p-8"
          >
            <Waypoints className="h-12 w-12 text-muted" aria-hidden="true" />
            <p className="font-body text-sm text-muted">
              No LLM usage recorded in this period. Start a conversation or run a cron.
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            <UsageKpiCards summary={summary} />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AgentUsageBarChart agents={summary.series?.by_agent ?? []} />
              <ModelUsageDonut
                models={summary.series?.by_model ?? []}
                totalTokens={summary.total_tokens ?? 0}
              />
            </div>
            <TopRunsSection
              usageFilter={usageFilter}
              modelName={filter.modelName}
              limit={DASHBOARD_TOP_RUNS_LIMIT}
            />
          </div>
        ))}
    </div>
  );
}

function RunsTab({
  filter,
  updateFilter,
  agentOptions,
  modelOptions,
  usageFilter,
}: Readonly<TabSharedProps>) {
  const [runsLimit, setRunsLimit] = useState<number>(DEFAULT_RUNS_LIMIT);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <TracesFilters
        value={filter}
        onChange={updateFilter}
        agentOptions={agentOptions}
        modelOptions={modelOptions}
      />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="traces-runs-limit" className="mb-2 block">
            Limit
          </Label>
          <Select value={String(runsLimit)} onValueChange={(next) => setRunsLimit(Number(next))}>
            <SelectTrigger id="traces-runs-limit" className="w-40" data-od-id="traces-runs-limit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUNS_LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  Top {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TopRunsSection usageFilter={usageFilter} modelName={filter.modelName} limit={runsLimit} />
    </div>
  );
}

function TraceList() {
  const [agentNameInput, setAgentNameInput] = useState("");
  // The exact agent filter is debounced: every keystroke updates the input,
  // but the applied filter (and therefore the request) only changes after
  // the debounce window — one request per filter, not per keystroke.
  const [appliedFilter, setAppliedFilter] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAppliedFilter(agentNameInput.trim()), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [agentNameInput]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTraces({
    agentName: appliedFilter || undefined,
  });

  // Pages accumulate: `Load more` appends the next page instead of
  // replacing previously loaded rows (a cursor has no "previous").
  const items = useMemo<TraceSummary[]>(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const hasFilter = appliedFilter.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-md font-body text-sm text-muted">
          Read-only, agent-filterable execution history across all threads. Filter matches the exact
          agent name.
        </p>
      </div>

      <div
        className="flex flex-wrap items-end justify-between gap-4 border border-border bg-surface p-4"
        data-od-id="traces-filter"
      >
        <div>
          <Label
            htmlFor="trace-agent-filter"
            className="mb-2 block text-xs uppercase tracking-[0.1em]"
          >
            Agent
          </Label>
          <Input
            id="trace-agent-filter"
            type="text"
            value={agentNameInput}
            onChange={(e) => setAgentNameInput(e.target.value)}
            placeholder="Exact agent name…"
            autoComplete="off"
            spellCheck={false}
            className="w-full min-w-64 sm:w-72"
          />
        </div>
        {hasNextPage && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            title={isFetchingNextPage ? "Loading next page" : "Load more traces"}
            data-od-id="traces-load-more"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>

      {isLoading && <LoadingRow label="Loading traces…" odId="traces-loading" />}

      {!isLoading && isError && (
        <ErrorRow
          message={error instanceof Error ? error.message : "Request failed"}
          odId="traces-error"
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div
          data-od-id="traces-empty"
          className="flex flex-col items-center justify-center gap-4 p-8"
        >
          <Waypoints className="h-12 w-12 text-muted" aria-hidden="true" />
          <p className="font-body text-sm text-muted">
            {hasFilter
              ? "No traces match this agent filter."
              : "No traces yet. Start a conversation or run a cron."}
          </p>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="flex flex-col gap-3" data-od-id="traces-list">
          {items.map((trace) => (
            <TraceRow key={trace.thread_id} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
}

function TraceRow({ trace }: Readonly<{ trace: TraceSummary }>) {
  // The whole row is a NATIVE anchor (Sonar S6819/S6848 stay satisfied):
  // click and Enter navigate; the accessible name is the row content. The
  // Tetris presentation is unchanged (same tokens, hover + focus ring).
  return (
    <Link
      to={`/traces/${trace.thread_id}`}
      data-od-id="trace-row"
      className="flex cursor-pointer flex-col gap-3 border border-border bg-surface p-4 transition-[background-color] duration-fast ease-standard hover:bg-surface-warm focus-visible:outline-none focus-visible:shadow-focus md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ThreadSourceBadge source={trace.source} />
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-fg">{trace.agent_name}</p>
          <p className="truncate font-mono text-xs text-muted">
            Thread {shortThreadId(trace.thread_id)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted">
        <span>
          <span className="uppercase tracking-[0.1em]">Started</span>{" "}
          {formatDateTime(trace.started_at)}
        </span>
        <span>
          <span className="uppercase tracking-[0.1em]">Last event</span>{" "}
          {formatDateTime(trace.last_event_at)}
        </span>
        <span>{trace.event_count} events</span>
        <span>{trace.turn_count} turns</span>
      </div>
    </Link>
  );
}

/**
 * Read-only trace detail (spec §TRC-003): reuses the existing local thread
 * timeline presentation without any composer or invocation control.
 * Missing/inaccessible threads surface the existing non-enumerating
 * not-found behaviour as an explicit error state.
 */
function TraceDetail({ threadId }: Readonly<{ threadId: string }>) {
  const { data: history, isError, error, refetch } = useThreadHistory(threadId);
  const agentName = history?.thread?.agent_name;

  return (
    <AppShell>
      <div data-od-id="traces-view" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2 md:px-6">
          <Link
            to="/traces"
            data-od-id="traces-back-link"
            className="flex items-center gap-1 font-mono text-xs uppercase tracking-[0.1em] text-muted transition-colors duration-fast ease-standard hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to all traces
          </Link>
          {agentName && (
            <span className="min-w-0 truncate font-mono text-xs text-fg-2">{agentName}</span>
          )}
        </div>
        {isError ? (
          <div
            role="alert"
            data-od-id="trace-detail-error"
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="border border-danger bg-danger/10 p-4">
              <p className="font-mono text-xs text-danger">
                {error instanceof Error ? error.message : "Trace not found"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <MessageList threadId={threadId} agentName={agentName ?? "Agent"} readOnly />
        )}
      </div>
    </AppShell>
  );
}
