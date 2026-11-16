import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
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
import { useAgents } from "@/application/hooks/agent/useAgents";
import { useCreateCron } from "@/application/hooks/cron/useCreateCron";
import { useUpdateCron } from "@/application/hooks/cron/useUpdateCron";
import type { CronSchedule } from "@/domain/entities/cron/cronSchedule";
import { isValidCronExpression, isValidTimeZone } from "@/domain/entities/cron/cronValidation";

interface CronEditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: "create" | "edit";
  readonly cron?: CronSchedule;
}

/**
 * Cron create/edit dialog (spec §CRN-002, §CRN-007). The expression must be
 * a standard five-field cron (no seconds) and the timezone a valid IANA
 * identifier. The backend remains authoritative for the remaining checks.
 * The dialog is mounted only while open, so the form state is freshly
 * initialized per session.
 */
export default function CronEditorDialog({
  open,
  onOpenChange,
  mode,
  cron,
}: Readonly<CronEditorDialogProps>) {
  const createCron = useCreateCron();
  const updateCron = useUpdateCron();
  const {
    data: agents,
    isLoading: agentsLoading,
    isError: agentsError,
    error: agentsErrorValue,
    refetch: refetchAgents,
  } = useAgents();
  const [name, setName] = useState(cron?.name ?? "");
  const [agentName, setAgentName] = useState(cron?.agent_name ?? "");
  const [message, setMessage] = useState(cron?.message ?? "");
  const [expression, setExpression] = useState(cron?.cron_expression ?? "");
  const [timezone, setTimezone] = useState(cron?.timezone ?? "UTC");
  const [errors, setErrors] = useState<string[]>([]);

  const isPending = mode === "create" ? createCron.isPending : updateCron.isPending;

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation: string[] = [];
    if (!name.trim()) validation.push("Name is required");
    if (!agentName) validation.push("Agent is required");
    if (!message.trim()) validation.push("Message is required");
    if (!isValidCronExpression(expression)) {
      validation.push(
        "Cron expression must have exactly five fields — six fields or seconds are an invalid cron expression",
      );
    }
    if (!isValidTimeZone(timezone.trim())) {
      validation.push("Timezone must be a valid IANA timezone identifier (e.g. UTC)");
    }
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setErrors([]);
    if (mode === "create") {
      createCron.mutate(
        {
          name: name.trim(),
          agent_name: agentName,
          message: message.trim(),
          cron_expression: expression.trim(),
          timezone: timezone.trim(),
          enabled: true,
        },
        {
          onSuccess: (created) => {
            toast.success(`Cron "${created.name}" created`);
            onOpenChange(false);
          },
          onError: (mutationError) => setErrors([mutationError.message]),
        },
      );
    } else if (cron) {
      updateCron.mutate(
        {
          id: cron.id,
          name: name.trim(),
          agent_name: agentName,
          message: message.trim(),
          cron_expression: expression.trim(),
          timezone: timezone.trim(),
        },
        {
          onSuccess: (updated) => {
            toast.success(`Cron "${updated.name}" updated`);
            onOpenChange(false);
          },
          onError: (mutationError) => setErrors([mutationError.message]),
        },
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-[0.06em]">
            {mode === "create" ? "New Cron" : "Edit Cron"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Schedules unattended agent invocations. Overlapping runs are skipped; failed runs are
            not retried.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-od-id="cron-editor-form">
          <div>
            <Label htmlFor="cron-name" className="mb-2 block text-xs uppercase tracking-[0.1em]">
              Name
            </Label>
            <Input
              id="cron-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="daily-digest…"
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="cron-agent" className="mb-2 block text-xs uppercase tracking-[0.1em]">
              Agent
            </Label>
            <Select value={agentName || undefined} onValueChange={(v) => setAgentName(v)}>
              <SelectTrigger id="cron-agent" className="w-full">
                <SelectValue placeholder="Select an agent…" />
              </SelectTrigger>
              <SelectContent>
                {(agents ?? []).map((agent) => (
                  <SelectItem key={agent.name} value={agent.name}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Spec §6 required states: loading, failure with retry, and an
                explicit empty message only once the list RESOLVED empty. */}
            {agentsLoading && !agentsError && (
              <p className="mt-1.5 font-mono text-xs text-muted" aria-live="polite">
                Loading agents…
              </p>
            )}
            {agentsError && (
              <div
                role="alert"
                data-od-id="cron-agents-load-error"
                className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border border-danger bg-danger/10 p-3"
              >
                <p className="font-mono text-xs text-danger">
                  {agentsErrorValue instanceof Error
                    ? agentsErrorValue.message
                    : "Failed to load agents"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchAgents()}
                >
                  Retry
                </Button>
              </div>
            )}
            {!agentsLoading && !agentsError && (agents ?? []).length === 0 && (
              <p className="mt-1.5 font-mono text-xs text-muted">
                No agents available. Create an agent first.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="cron-message" className="mb-2 block text-xs uppercase tracking-[0.1em]">
              Message
            </Label>
            <Input
              id="cron-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message sent to the agent on each run…"
              autoComplete="off"
            />
          </div>

          <div>
            <Label
              htmlFor="cron-expression"
              className="mb-2 block text-xs uppercase tracking-[0.1em]"
            >
              Cron expression
            </Label>
            <Input
              id="cron-expression"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="0 9 * * *"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 font-mono text-xs text-muted">
              Standard format — no seconds, exactly:
            </p>
          </div>

          <div>
            <Label
              htmlFor="cron-timezone"
              className="mb-2 block text-xs uppercase tracking-[0.1em]"
            >
              Time Zone
            </Label>
            <Input
              id="cron-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {errors.map((message) => (
            <p key={message} role="alert" className="font-mono text-xs text-danger">
              {message}
            </p>
          ))}

          <div className="flex items-center justify-end gap-3 border-t border-border-soft pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
