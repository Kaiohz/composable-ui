import { useState, type SyntheticEvent } from "react";
import { toast } from "sonner";
import { useCreateMemory } from "@/application/hooks/memory/useCreateMemory";
import { extractApiMessage } from "@/infrastructure/api/store/storeApi";
import { memoriesNamespacePrefix } from "@/domain/entities/space/memoryPaths";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  STRUCTURED_DIALOG_BODY_CLASS,
  STRUCTURED_DIALOG_CONTENT_CLASS,
} from "@/application/components/ui/dialog";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import { Textarea } from "@/application/components/ui/textarea";
import { cn } from "@/application/lib/utils";

interface CreateMemoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Target space agent slug (REQ-022): personal is the flat `/memories/`
   * namespace, otherwise the memory is created inside the agent scope.
   */
  readonly spaceSlug?: string;
}

const MEMORY_FORM_ID = "memory-create-form";

/**
 * Dialog to create a new memory file in the TARGET space: a name (becomes
 * `/memories/{name}.md` in the personal space, `/memories/{agent_slug}/{name}.md`
 * in an agent scope) and a markdown body. No frontmatter for memories.
 */
export function CreateMemoryDialog({
  open,
  onOpenChange,
  spaceSlug = PERSONAL_SLUG,
}: Readonly<CreateMemoryDialogProps>) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const createMemory = useCreateMemory();
  // REQ-022 — the dialog DISPLAYS the target space and creates inside it.
  const targetPathLabel = `${memoriesNamespacePrefix(spaceSlug)}<name>.md`;
  const directory = spaceSlug === PERSONAL_SLUG ? "" : spaceSlug;

  function handleClose() {
    setName("");
    setContent("");
    onOpenChange(false);
  }

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Memory name is required");
      return;
    }
    createMemory.mutate(
      { name: trimmedName, content, directory },
      {
        onSuccess: () => {
          toast.success("Memory created successfully");
          handleClose();
        },
        onError: (error) => {
          toast.error(extractApiMessage(error));
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className={cn(STRUCTURED_DIALOG_CONTENT_CLASS, "max-w-2xl")}>
        <div className="shrink-0 border-b border-border bg-surface px-6 pb-4 pt-6 sm:px-8">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="font-display text-lg">Create Memory</DialogTitle>
            <DialogDescription className="text-sm text-muted">
              Create a markdown memory file in the{" "}
              <span className="font-mono text-fg-2">
                {spaceSlug === PERSONAL_SLUG ? "Personal" : spaceSlug}
              </span>{" "}
              space at <span className="font-mono text-fg-2">{targetPathLabel}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={STRUCTURED_DIALOG_BODY_CLASS}>
          <form id={MEMORY_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label
                htmlFor="memory-name"
                className="mb-2 block text-xs uppercase tracking-[0.1em]"
              >
                Name
              </Label>
              <Input
                id="memory-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AGENTS"
                autoComplete="off"
                spellCheck={false}
                aria-label="Name"
              />
            </div>

            <div>
              <Label
                htmlFor="memory-content"
                className="mb-2 block text-xs uppercase tracking-[0.1em]"
              >
                Content
              </Label>
              <Textarea
                id="memory-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Project rules and conventions…"
                rows={12}
                className="font-mono text-xs"
                aria-label="Content"
              />
            </div>
          </form>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-border bg-surface px-6 py-4 sm:px-8">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button type="submit" form={MEMORY_FORM_ID} disabled={createMemory.isPending}>
            {createMemory.isPending ? "Creating…" : "Create Memory"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateMemoryDialog;
