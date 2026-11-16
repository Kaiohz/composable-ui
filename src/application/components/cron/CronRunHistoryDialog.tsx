import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
import ThreadSourceBadge from "@/application/components/shared/ThreadSourceBadge";
import StatusBadge from "@/application/components/shared/StatusBadge";
import { useCronRuns } from "@/application/hooks/cron/useCronRuns";
import type { CronRun } from "@/domain/entities/cron/cronSchedule";

interface CronRunHistoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly cronId: string;
  readonly cronName: string;
}

/**
 * Paginated run history for a cron (spec §CRN-007): newest first, with
 * trigger, terminal status, timing, safe failure details, the CRON source
 * pill and a direct trace link whenever the run produced a thread.
 */
export default function CronRunHistoryDialog({
  open,
  onOpenChange,
  cronId,
  cronName,
}: Readonly<CronRunHistoryDialogProps>) {
  // Loaded while open, bounded by the backend's maximum page size (200);
  // refetch happens on focus/navigation via the query cache (no websocket
  // in v1, spec §CRN-007).
  const { data: runs, isLoading } = useCronRuns(open ? cronId : null, { limit: 200 });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-[0.06em]">
            {cronName} — Run history
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Newest first. Failed runs are terminal; overlapping runs are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3" data-od-id="cron-run-history">
          {isLoading && (
            <p className="py-4 text-center font-mono text-xs text-muted" aria-live="polite">
              Loading run history…
            </p>
          )}

          {!isLoading && (runs ?? []).length === 0 && (
            <p className="py-4 text-center font-mono text-xs text-muted">
              No runs yet for this cron.
            </p>
          )}

          {(runs ?? []).map((run) => (
            <CronRunRow key={run.id} run={run} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CronRunRow({ run }: Readonly<{ run: CronRun }>) {
  return (
    <article
      data-od-id="cron-run"
      className="flex flex-col gap-2 border border-border bg-surface-warm p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="border border-border px-2 py-0.5 font-mono text-xs uppercase tracking-[0.1em] text-muted">
          {run.trigger}
        </span>
        <StatusBadge status={run.status} />
        <ThreadSourceBadge source={run.source} />
        {run.thread_id && (
          <Link
            to={`/traces/${run.thread_id}`}
            data-od-id="cron-run-trace-link"
            className="font-mono text-xs uppercase tracking-[0.1em] text-accent underline-offset-4 hover:underline"
          >
            View trace
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted">
        {run.occurrence_at && <span>Occurrence {formatTimestamp(run.occurrence_at)}</span>}
        <span>Started {formatTimestamp(run.started_at)}</span>
        <span>Finished {formatTimestamp(run.finished_at)}</span>
      </div>
      {run.error && (
        <p role="alert" className="font-mono text-xs text-danger">
          {run.error}
        </p>
      )}
    </article>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
