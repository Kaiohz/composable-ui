import { useState } from "react";
import { Plus, Timer } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import CronEditorDialog from "@/application/components/cron/CronEditorDialog";
import CronRunHistoryDialog from "@/application/components/cron/CronRunHistoryDialog";
import StatusBadge from "@/application/components/shared/StatusBadge";
import { Button } from "@/application/components/ui/button";
import { Badge } from "@/application/components/ui/badge";
import {
  RESOURCE_CARD_GRID_CLASS,
  ResourceCard,
  ResourceCardDeleteButton,
  ResourceCardFooter,
} from "@/application/components/ui/resource-card";
import { toast } from "sonner";
import { useCrons } from "@/application/hooks/cron/useCrons";
import { useDeleteCron } from "@/application/hooks/cron/useDeleteCron";
import { useUpdateCron } from "@/application/hooks/cron/useUpdateCron";
import { useRunCron } from "@/application/hooks/cron/useRunCron";
import type { CronSchedule } from "@/domain/entities/cron/cronSchedule";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function CronsPage() {
  const { data: crons, isLoading, isError, error, refetch } = useCrons();
  const deleteCron = useDeleteCron();
  const updateCron = useUpdateCron();
  const runCron = useRunCron();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingCron, setEditingCron] = useState<CronSchedule | undefined>(undefined);
  const [historyCron, setHistoryCron] = useState<CronSchedule | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const items = crons ?? [];

  function openEdit(cron: CronSchedule) {
    setEditorMode("edit");
    setEditingCron(cron);
    setEditorOpen(true);
  }

  function handleToggleEnabled(cron: CronSchedule) {
    updateCron.mutate(
      { id: cron.id, enabled: !cron.enabled },
      {
        onSuccess: (updated) => {
          toast.success(updated.enabled ? "Cron enabled" : "Cron disabled");
        },
        onError: (mutationError) => {
          toast.error(mutationError.message);
        },
      },
    );
  }

  function handleRunNow(cron: CronSchedule) {
    // Run now is permitted while disabled; it still creates a cron thread.
    runCron.mutate(cron.id, {
      onSuccess: () => {
        toast.success(`Cron "${cron.name}" triggered`);
      },
      onError: (mutationError) => {
        toast.error(mutationError.message);
      },
    });
  }

  function handleDelete(cron: CronSchedule) {
    if (confirmingId !== cron.id) {
      setConfirmingId(cron.id);
      return;
    }
    deleteCron.mutate(cron.id, {
      onSuccess: () => {
        toast.success(`Cron "${cron.name}" deleted`);
        setConfirmingId(null);
      },
      onError: (mutationError) => {
        toast.error(mutationError.message);
        setConfirmingId(null);
      },
    });
  }

  return (
    <AppShell>
      <div
        className="crons-view flex flex-1 flex-col gap-6 overflow-y-auto bg-bg p-4 md:p-8"
        data-od-id="crons-view"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md font-body text-sm text-muted">
            Schedule unattended agent runs with a five-field cron expression and an IANA time zone.
            Overlap is skipped and failures are not retried.
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="default" data-od-id="cron-count">
              {items.length} cron{items.length === 1 ? "" : "s"}
            </Badge>
            <Button
              type="button"
              variant="default"
              data-od-id="cron-create"
              onClick={() => {
                setEditorMode("create");
                setEditingCron(undefined);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Cron
            </Button>
          </div>
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
            <span className="font-mono text-xs text-muted">Loading crons…</span>
          </div>
        )}

        {!isLoading && isError && (
          <div
            role="alert"
            data-od-id="crons-error"
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
            data-od-id="crons-empty"
            className="flex flex-col items-center justify-center gap-4 p-8"
          >
            <p className="font-body text-sm text-muted">
              No crons yet. Create a schedule to run an agent on a recurring basis.
            </p>
            <Button
              type="button"
              variant="secondary"
              data-od-id="cron-create-empty"
              onClick={() => {
                setEditorMode("create");
                setEditingCron(undefined);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Cron
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="crons-list">
            {items.map((cron) => (
              <CronCard
                key={cron.id}
                cron={cron}
                confirming={confirmingId === cron.id}
                onEdit={() => openEdit(cron)}
                onToggleEnabled={() => handleToggleEnabled(cron)}
                onRunNow={() => handleRunNow(cron)}
                onViewHistory={() => setHistoryCron(cron)}
                onConfirmDelete={() => handleDelete(cron)}
              />
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <CronEditorDialog
          key={editingCron?.id ?? "create"}
          open
          onOpenChange={setEditorOpen}
          mode={editorMode}
          cron={editingCron}
        />
      )}

      {historyCron && (
        <CronRunHistoryDialog
          key={historyCron.id}
          open
          onOpenChange={(open) => {
            if (!open) setHistoryCron(null);
          }}
          cronId={historyCron.id}
          cronName={historyCron.name}
        />
      )}
    </AppShell>
  );
}

interface CronCardProps {
  readonly cron: CronSchedule;
  readonly confirming: boolean;
  readonly onEdit: () => void;
  readonly onToggleEnabled: () => void;
  readonly onRunNow: () => void;
  readonly onViewHistory: () => void;
  readonly onConfirmDelete: () => void;
}

/**
 * Cron resource card, rendered through the shared resource-card composition
 * (spec unify-cards-modals CARD-001..010). The stable QA hook stays
 * `data-od-id="cron-row"`; the row is now a card in the standard responsive
 * grid. All scheduling/run information and workflow actions are retained.
 */
function CronCard({
  cron,
  confirming,
  onEdit,
  onToggleEnabled,
  onRunNow,
  onViewHistory,
  onConfirmDelete,
}: Readonly<CronCardProps>) {
  return (
    <ResourceCard
      odId="cron-row"
      icon={Timer}
      title={cron.name}
      badges={
        <>
          <span className="shrink-0 font-mono text-xs uppercase tracking-[0.1em] text-muted">
            {cron.enabled ? "Enabled" : "Disabled"}
          </span>
          {cron.last_run_status && (
            <StatusBadge status={cron.last_run_status} className="shrink-0" />
          )}
        </>
      }
    >
      <p className="truncate font-mono text-xs text-muted">
        agent <span className="text-fg">{cron.agent_name}</span>
      </p>

      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
        <span>
          <span className="text-muted uppercase tracking-[0.1em]">Expression</span>{" "}
          <span className="text-fg">{cron.cron_expression}</span>
        </span>
        <span>
          <span className="text-muted uppercase tracking-[0.1em]">Timezone</span>{" "}
          <span className="text-fg">{cron.timezone}</span>
        </span>
        <span>
          <span className="text-muted uppercase tracking-[0.1em]">Next run</span>{" "}
          <span className="text-fg">{formatDateTime(cron.next_run_at)}</span>
        </span>
        <span>
          <span className="text-muted uppercase tracking-[0.1em]">Last run</span>{" "}
          <span className="text-fg">{formatDateTime(cron.last_run_at)}</span>
        </span>
      </div>
      <p className="break-words font-mono text-xs text-fg-2">{cron.message}</p>

      <ResourceCardFooter>
        <Button type="button" variant="outline" size="sm" onClick={onToggleEnabled}>
          {cron.enabled ? "Disable" : "Enable"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onRunNow}>
          Run now
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onViewHistory}>
          Run History
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <ResourceCardDeleteButton
          resourceName={cron.name}
          confirming={confirming}
          onActivate={onConfirmDelete}
        />
      </ResourceCardFooter>
    </ResourceCard>
  );
}
