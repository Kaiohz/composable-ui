import { Folder, Trash } from "lucide-react";
import { Button } from "@/application/components/ui/button";
import { cn } from "@/application/lib/utils";
import IndexActionMenu from "@/application/components/rag/IndexActionMenu";

interface FolderRowProps {
  name: string;
  onClick: () => void;
  isIndexing?: boolean;
  onIndexClassical?: () => void;
  onDelete?: () => void;
}

export default function FolderRow({
  name,
  onClick,
  isIndexing,
  onIndexClassical,
  onDelete,
}: Readonly<FolderRowProps>) {
  // The folder name doubles as the accessible DESCRIPTION of the row actions
  // (aria-describedby feeds the description, not the name), so the action
  // buttons convey WHICH folder they target while the row-opening control
  // stays the unique accessible-name match for the folder (the behavioral
  // navigation query resolves by name).
  const nameId = `folder-row-name-${name}`;

  return (
    <div
      data-od-id={`file-row-${name}`}
      className={cn(
        "grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-border-soft transition-[background-color] duration-fast ease-standard hover:bg-surface-warm",
        isIndexing && "opacity-60",
      )}
    >
      {/* The folder-opening control is a NATIVE button (Sonar S6819/S6848):
          only the icon + name cells open the folder; the row-level actions
          stay outside the button so no interactive element is nested. */}
      <button
        type="button"
        onClick={onClick}
        className="col-span-2 flex min-w-0 items-center gap-3 py-2 pl-3 text-left cursor-pointer transition-[background-color] duration-fast ease-standard hover:bg-surface-warm focus-visible:outline-none focus-visible:shadow-focus"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center text-accent"
          aria-label="folder icon"
        >
          <Folder className="h-5 w-5" aria-hidden="true" />
        </span>
        <span id={nameId} className="text-sm text-fg font-body truncate">
          {name}
        </span>
      </button>
      <div className="flex items-center gap-1 pr-3">
        {isIndexing && (
          <span className="spin text-accent" aria-hidden="true" data-testid="folder-spinner" />
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            /* Name-free accessible LABEL (the folder name travels in the
               description above) — the row-opening control must stay the
               unique name match for the folder (behavioral contract). */
            aria-label="Delete folder"
            aria-describedby={nameId}
            data-od-id={`folder-delete-${name}`}
          >
            <Trash className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {onIndexClassical && (
          <IndexActionMenu
            onIndexClassical={onIndexClassical}
            ariaLabel="Index folder"
            ariaDescribedBy={nameId}
          />
        )}
      </div>
    </div>
  );
}
