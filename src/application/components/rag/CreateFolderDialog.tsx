import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/application/components/ui/dialog";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";

interface CreateFolderDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreate: (name: string) => void;
  readonly isPending?: boolean;
}

export default function CreateFolderDialog({
  open,
  onClose,
  onCreate,
  isPending,
}: Readonly<CreateFolderDialogProps>) {
  const [name, setName] = useState("");

  function handleClose() {
    setName("");
    onClose();
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      {/* Simple dialog: inherits the shared viewport bound, internal
          scrolling and responsive padding; the sections below only carry
          their structural separators (spec MODAL-001/002, SPACE-003). */}
      <DialogContent data-od-id="create-folder-dialog" className="max-w-md">
        <DialogHeader className="border-b border-border pb-4 space-y-1.5">
          <DialogTitle className="font-display text-lg">New Folder</DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Enter a name for the new folder.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            type="text"
            aria-label="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="folder-name..."
            autoComplete="off"
            spellCheck={false}
            disabled={isPending}
          />
        </div>

        <DialogFooter className="gap-2 border-t border-border py-4">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            data-od-id="confirm-create-folder"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
