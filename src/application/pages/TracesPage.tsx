import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Waypoints } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import MessageList from "@/application/components/chat/MessageList";
import ThreadSourceBadge from "@/application/components/shared/ThreadSourceBadge";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import { useThreadHistory } from "@/application/hooks/chat/useThreadHistory";
import { useTraces } from "@/application/hooks/trace/useTraces";
import type { TraceSummary } from "@/domain/entities/trace/traceSummary";

const SHORT_ID_LENGTH = 8;
const FILTER_DEBOUNCE_MS = 250;

function shortThreadId(threadId: string): string {
  return threadId.slice(0, SHORT_ID_LENGTH);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TracesPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  if (threadId) {
    return <TraceDetail threadId={threadId} />;
  }
  return <TraceList />;
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
    <AppShell>
      <div
        className="traces-view flex flex-1 flex-col gap-6 overflow-y-auto bg-bg p-4 md:p-8"
        data-od-id="traces-view"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md font-body text-sm text-muted">
            Read-only, agent-filterable execution history across all threads. Filter matches the
            exact agent name.
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

        {isLoading && (
          <div
            className="flex items-center justify-center gap-2 p-8"
            aria-busy="true"
            aria-live="polite"
          >
            <span
              className="spin inline-block h-4 w-4 border-2 border-accent border-t-transparent"
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-muted">Loading traces…</span>
          </div>
        )}

        {!isLoading && isError && (
          <div
            role="alert"
            data-od-id="traces-error"
            className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-4"
          >
            <p className="font-mono text-xs text-danger">
              {error instanceof Error ? error.message : "Request failed"}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
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
    </AppShell>
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
