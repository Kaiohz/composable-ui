import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/application/components/ui/dialog";
import { Button } from "@/application/components/ui/button";

interface ConfirmDeleteDialogProps {
  readonly open: boolean;
  readonly name: string;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
  readonly isPending?: boolean;
}

export default function ConfirmDeleteDialog({
  open,
  name,
  onConfirm,
  onClose,
  isPending,
}: Readonly<ConfirmDeleteDialogProps>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) onClose();
      }}
    >
      {/* Simple dialog: inherits the shared viewport bound, internal
          scrolling and responsive padding; the sections below only carry
          their structural separators (spec MODAL-001/002, SPACE-003). */}
      <DialogContent data-od-id="delete-confirm-dialog" className="max-w-md">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="font-display text-lg">Delete {name}</DialogTitle>
          <DialogDescription className="text-sm text-muted">
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            data-od-id="confirm-delete"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
