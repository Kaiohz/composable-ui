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
import { Textarea } from "@/application/components/ui/textarea";
import { useCreatePrompt } from "@/application/hooks/prompt/useCreatePrompt";
import { useUpdatePrompt } from "@/application/hooks/prompt/useUpdatePrompt";
import type { PromptMetadata } from "@/domain/entities/prompt/prompt";

interface PromptEditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: "create" | "edit";
  readonly prompt?: PromptMetadata;
}

/**
 * Create/edit dialog for prompt metadata (spec §PR-006). Content is only
 * editable while creating (it becomes immutable version 1); metadata edits
 * never carry or change content. The dialog is mounted only while open, so
 * the form state is freshly initialized for each session.
 */
export default function PromptEditorDialog({
  open,
  onOpenChange,
  mode,
  prompt,
}: Readonly<PromptEditorDialogProps>) {
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const [name, setName] = useState(prompt?.name ?? "");
  const [description, setDescription] = useState(prompt?.description ?? "");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isPending = mode === "create" ? createPrompt.isPending : updatePrompt.isPending;

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (mode === "create" && content.trim().length === 0) {
      setError("Content is required");
      return;
    }
    setError(null);
    if (mode === "create") {
      createPrompt.mutate(
        {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          content,
        },
        {
          onSuccess: () => {
            toast.success(`Prompt "${name.trim()}" created`);
            onOpenChange(false);
          },
          onError: (mutationError) => setError(mutationError.message),
        },
      );
    } else if (prompt) {
      updatePrompt.mutate(
        {
          id: prompt.id,
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
        },
        {
          onSuccess: () => {
            toast.success(`Prompt "${name.trim()}" updated`);
            onOpenChange(false);
          },
          onError: (mutationError) => setError(mutationError.message),
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
            {mode === "create" ? "New Prompt" : "Edit Prompt"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            {mode === "create"
              ? "A prompt starts at version 1; every content change creates a new immutable version."
              : "Edit display metadata. Content changes require a new version from the version history."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-od-id="prompt-editor-form">
          <div>
            <Label htmlFor="prompt-name" className="mb-2 block text-xs uppercase tracking-[0.1em]">
              Name
            </Label>
            <Input
              id="prompt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="release-notes…"
              autoComplete="off"
            />
          </div>
          <div>
            <Label
              htmlFor="prompt-description"
              className="mb-2 block text-xs uppercase tracking-[0.1em]"
            >
              Description
            </Label>
            <Input
              id="prompt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this prompt for? (optional)…"
              autoComplete="off"
            />
          </div>
          {mode === "create" && (
            <div>
              <Label
                htmlFor="prompt-content"
                className="mb-2 block text-xs uppercase tracking-[0.1em]"
              >
                Content
              </Label>
              <Textarea
                id="prompt-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="System prompt content…"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="mt-1.5 font-mono text-xs text-muted">
                Stored verbatim, including whitespace.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="font-mono text-xs text-danger">
              {error}
            </p>
          )}

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
