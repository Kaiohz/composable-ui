import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
import { Button } from "@/application/components/ui/button";
import { Label } from "@/application/components/ui/label";
import { Textarea } from "@/application/components/ui/textarea";
import { cn } from "@/application/lib/utils";
import { usePromptVersions } from "@/application/hooks/prompt/usePromptVersions";
import { usePromptVersion } from "@/application/hooks/prompt/usePromptVersion";
import { useCreatePromptVersion } from "@/application/hooks/prompt/useCreatePromptVersion";
import { useDeletePrompt } from "@/application/hooks/prompt/useDeletePrompt";
import type { PromptMetadata, PromptVersionSummary } from "@/domain/entities/prompt/prompt";

interface PromptVersionsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly prompt: PromptMetadata;
}

/**
 * Immutable version history and content viewer (spec §PR-003/PR-006).
 * Existing versions can only be inspected; adding content is an explicit
 * "New Version" action that appends the next sequential numeric version.
 * The dialog is mounted only while open, so view state is freshly
 * initialized per session.
 */
export default function PromptVersionsDialog({
  open,
  onOpenChange,
  prompt,
}: Readonly<PromptVersionsDialogProps>) {
  const {
    data: versions,
    isLoading: versionsLoading,
    isError: versionsError,
    error: versionsErrorValue,
    refetch: refetchVersions,
  } = usePromptVersions(open ? prompt.id : null);
  const createPromptVersion = useCreatePromptVersion();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [addingVersion, setAddingVersion] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Numeric, ascending order (spec §PR-003). List rows are summaries
  // (version number + timestamp, QA BUG-004).
  const orderedVersions = useMemo<PromptVersionSummary[]>(
    () => (versions ?? []).slice().sort((a, b) => a.version - b.version),
    [versions],
  );

  const selected =
    selectedVersion != null
      ? orderedVersions.find((v) => v.version === selectedVersion)
      : orderedVersions.at(-1);

  // The immutable content of the SELECTED version is fetched through the
  // version-detail endpoint; the list never carries content.
  const {
    data: versionDetail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorValue,
    refetch: refetchDetail,
  } = usePromptVersion(prompt.id, selected?.version ?? null);

  function handleAddVersion() {
    if (content.trim().length === 0) {
      setError("Content is required");
      return;
    }
    setError(null);
    createPromptVersion.mutate(
      { promptId: prompt.id, content },
      {
        onSuccess: (version) => {
          toast.success(`Version ${version.version} created`);
          setAddingVersion(false);
          setContent("");
          setSelectedVersion(version.version);
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  }

  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      {/* Non-modal root (above): the version history may stay open while the
          operator still interacts with the prompt list (Spec §PR-006 in-use
          errors "without closing or losing the current view", BUG-003) —
          Radix then skips hiding the outside content, so card actions remain
          in the accessibility tree and reachable. */}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-[0.06em]">
            {prompt.name} — Version history
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Versions are immutable. Existing content cannot be edited or deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" data-od-id="prompt-versions-dialog">
          <div className="flex flex-wrap gap-1.5" data-od-id="prompt-versions-list">
            {versionsLoading && (
              <p className="font-mono text-xs text-muted" aria-live="polite">
                Loading versions…
              </p>
            )}
            {!versionsLoading && !versionsError && orderedVersions.length === 0 && (
              <p className="font-mono text-xs text-muted">No versions found</p>
            )}
            {orderedVersions.map((version) => {
              const isActive = selected?.version === version.version;
              return (
                <button
                  key={version.version}
                  type="button"
                  data-od-id="prompt-version"
                  onClick={() => setSelectedVersion(version.version)}
                  className={cn(
                    "border px-3 py-1 font-mono text-xs uppercase tracking-[0.1em] transition-[background-color,border-color,color] duration-fast ease-standard focus-visible:outline-none focus-visible:shadow-focus",
                    isActive
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-transparent text-muted hover:bg-surface-warm hover:text-fg",
                  )}
                >
                  v{version.version}
                </button>
              );
            })}
          </div>

          {versionsError && (
            <div
              role="alert"
              data-od-id="prompt-versions-error"
              className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-3"
            >
              <p className="font-mono text-xs text-danger">
                {versionsErrorValue instanceof Error
                  ? versionsErrorValue.message
                  : "Failed to load version history"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetchVersions()}
              >
                Retry
              </Button>
            </div>
          )}

          {selected && !versionsError && (
            <div data-od-id="prompt-version-content">
              <p className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                v{selected.version} —{" "}
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                  new Date(selected.created_at),
                )}
              </p>
              {detailLoading && (
                <p
                  className="border border-border-soft bg-surface-warm p-3 font-mono text-xs text-muted"
                  aria-live="polite"
                >
                  Loading content…
                </p>
              )}
              {!detailLoading && detailError && (
                <div
                  role="alert"
                  data-od-id="prompt-version-content-error"
                  className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-3"
                >
                  <p className="font-mono text-xs text-danger">
                    {detailErrorValue instanceof Error
                      ? detailErrorValue.message
                      : "Failed to load version content"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refetchDetail()}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {!detailLoading && !detailError && versionDetail && (
                <div className="max-h-60 overscroll-contain overflow-y-auto border border-border-soft bg-surface-warm p-3 font-mono text-xs leading-relaxed text-fg-2">
                  {versionDetail.content}
                </div>
              )}
            </div>
          )}

          {addingVersion ? (
            <div className="space-y-2" data-od-id="prompt-new-version">
              <Label
                htmlFor="prompt-new-version-content"
                className="block text-xs uppercase tracking-[0.1em]"
              >
                Content
              </Label>
              <Textarea
                id="prompt-new-version-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="New prompt wording…"
                rows={6}
                className="font-mono text-xs"
              />
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddingVersion(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddVersion}
                  disabled={createPromptVersion.isPending}
                >
                  Add Version
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-border-soft pt-4">
              <NewVersionButton onAdd={() => setAddingVersion(true)} />
              <div className="flex items-center gap-3">
                <DialogPromptDelete promptId={prompt.id} onDeleted={() => onOpenChange(false)} />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="font-mono text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewVersionButton({ onAdd }: Readonly<{ onAdd: () => void }>) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onAdd}
      data-od-id="prompt-new-version-action"
    >
      New Version
    </Button>
  );
}

function DialogPromptDelete({
  promptId,
  onDeleted,
}: Readonly<{ promptId: string; onDeleted: () => void }>) {
  const deletePrompt = useDeletePrompt();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deletePrompt.mutate(promptId, {
      onSuccess: () => {
        toast.success("Prompt deleted");
        onDeleted();
      },
      // In-use (409) errors stay visible: the view is not closed, the
      // operator can still inspect version history (spec §PR-006).
      onError: (mutationError) => {
        // Synchronous flush so conflict feedback is immediate, even when the
        // mutation error is delivered outside a React batch.
        flushSync(() => {
          setDeleteError(mutationError.message);
          setConfirming(false);
        });
      },
    });
  }

  return (
    <div className="flex items-center gap-3">
      {deleteError && (
        <p role="alert" className="font-mono text-xs text-danger">
          {deleteError}
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        data-od-id="prompt-dialog-delete"
        onClick={handleDelete}
        disabled={deletePrompt.isPending}
      >
        {confirming ? "Confirm Delete?" : "Delete"}
      </Button>
    </div>
  );
}
