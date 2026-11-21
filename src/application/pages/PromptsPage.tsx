import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import PromptEditorDialog from "@/application/components/prompt/PromptEditorDialog";
import PromptVersionsDialog from "@/application/components/prompt/PromptVersionsDialog";
import { Button } from "@/application/components/ui/button";
import { Badge } from "@/application/components/ui/badge";
import {
  RESOURCE_CARD_GRID_CLASS,
  ResourceCard,
  ResourceCardDeleteButton,
  ResourceCardFooter,
} from "@/application/components/ui/resource-card";
import { toast } from "sonner";
import { usePrompts } from "@/application/hooks/prompt/usePrompts";
import { useDeletePrompt } from "@/application/hooks/prompt/useDeletePrompt";
import type { PromptMetadata } from "@/domain/entities/prompt/prompt";

const SHORT_ID_LENGTH = 8;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function PromptsPage() {
  const { data: prompts, isLoading, isError, error, refetch } = usePrompts();
  const deletePrompt = useDeletePrompt();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingPrompt, setEditingPrompt] = useState<PromptMetadata | undefined>(undefined);
  const [versionsPrompt, setVersionsPrompt] = useState<PromptMetadata | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const items = prompts ?? [];

  function openEdit(prompt: PromptMetadata) {
    setEditorMode("edit");
    setEditingPrompt(prompt);
    setEditorOpen(true);
  }

  function handleDeleteFromList(prompt: PromptMetadata) {
    if (confirmingId !== prompt.id) {
      setConfirmingId(prompt.id);
      setDeleteError(null);
      return;
    }
    deletePrompt.mutate(prompt.id, {
      onSuccess: () => {
        toast.success(`Prompt "${prompt.name}" deleted`);
        setConfirmingId(null);
      },
      // In-use (409) errors: the list stays open and the reason is visible.
      onError: (mutationError) => {
        setDeleteError({
          id: prompt.id,
          message: mutationError.message || "Prompt is in use by one or more agents",
        });
        setConfirmingId(null);
      },
    });
  }

  return (
    <AppShell>
      <div
        className="prompts-view flex flex-1 flex-col gap-6 overflow-y-auto bg-bg p-4 md:p-8"
        data-od-id="prompts-view"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md font-body text-sm text-muted">
            Local prompt registry, independent of Phoenix. Each prompt keeps an immutable version
            history; edits to content create a new version.
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="default" data-od-id="prompt-count">
              {items.length} prompt{items.length === 1 ? "" : "s"}
            </Badge>
            <Button
              type="button"
              variant="default"
              data-od-id="prompt-create"
              onClick={() => {
                setEditorMode("create");
                setEditingPrompt(undefined);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Prompt
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
            <span className="font-mono text-xs text-muted">Loading prompts…</span>
          </div>
        )}

        {!isLoading && isError && (
          <div
            role="alert"
            data-od-id="prompts-error"
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
            data-od-id="prompts-empty"
            className="flex flex-col items-center justify-center gap-4 p-8"
          >
            <p className="font-body text-sm text-muted">
              No prompts yet. Create your first registry prompt to reuse it in agents.
            </p>
            <Button
              type="button"
              variant="secondary"
              data-od-id="prompt-create-empty"
              onClick={() => {
                setEditorMode("create");
                setEditingPrompt(undefined);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Prompt
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="prompts-list">
            {items.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                confirming={confirmingId === prompt.id}
                deleteError={deleteError?.id === prompt.id ? deleteError.message : null}
                onEdit={() => openEdit(prompt)}
                onConfirmDelete={() => handleDeleteFromList(prompt)}
                onViewVersions={() => setVersionsPrompt(prompt)}
              />
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <PromptEditorDialog
          key={editingPrompt?.id ?? "create"}
          open
          onOpenChange={setEditorOpen}
          mode={editorMode}
          prompt={editingPrompt}
        />
      )}

      {versionsPrompt && (
        <PromptVersionsDialog
          key={versionsPrompt.id}
          open
          onOpenChange={(open) => {
            if (!open) setVersionsPrompt(null);
          }}
          prompt={versionsPrompt}
        />
      )}
    </AppShell>
  );
}

interface PromptCardProps {
  readonly prompt: PromptMetadata;
  readonly confirming: boolean;
  readonly deleteError: string | null;
  readonly onEdit: () => void;
  readonly onConfirmDelete: () => void;
  readonly onViewVersions: () => void;
}

function PromptCard({
  prompt,
  confirming,
  deleteError,
  onEdit,
  onConfirmDelete,
  onViewVersions,
}: Readonly<PromptCardProps>) {
  return (
    <ResourceCard
      odId="prompt-card"
      icon={FileText}
      title={prompt.name}
      badges={
        <Badge variant="outline" data-od-id="prompt-latest-version" className="shrink-0">
          Version {prompt.latest_version}
        </Badge>
      }
    >
      {prompt.description && (
        <p className="break-words font-mono text-xs text-fg-2">{prompt.description}</p>
      )}
      <p className="font-mono text-xs text-muted">
        updated {formatDate(prompt.updated_at)} · {prompt.id.slice(0, SHORT_ID_LENGTH)}
      </p>

      {/* Card actions always render — an open modal must never mutate the
          list behind it (BUG-003); modal-internal queries are scoped to the
          dialog container instead. */}
      <ResourceCardFooter>
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onViewVersions}>
          Version History
        </Button>
        <ResourceCardDeleteButton
          resourceName={prompt.name}
          confirming={confirming}
          onActivate={onConfirmDelete}
        />
      </ResourceCardFooter>

      {deleteError && (
        <p role="alert" className="font-mono text-xs text-danger" data-od-id="prompt-delete-error">
          {deleteError}
        </p>
      )}
    </ResourceCard>
  );
}
