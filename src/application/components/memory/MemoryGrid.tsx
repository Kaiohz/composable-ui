import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useStoreFilePreviews } from "@/application/hooks/store/useStoreFilePreviews";
import MemoryCard from "@/application/components/memory/MemoryCard";
import { RESOURCE_CARD_GRID_CLASS } from "@/application/components/ui/resource-card";
import { isDirectMemoryChild } from "@/domain/entities/space/memoryPaths";

interface MemoryGridProps {
  /**
   * Memories namespace of the selected space (REQ-022): flat `/memories/` or
   * `/memories/{agent_slug}/`. Defaults to the flat personal namespace.
   */
  readonly memoriesPrefix?: string;
  readonly onCreateNew: () => void;
  /** Reports the requested memory's EXACT stored path (no reconstruction). */
  readonly onConfigure: (memoryPath: string) => void;
}

const DEFAULT_MEMORIES_PREFIX = "/memories/";
const PREVIEW_CHARS = 300;

export default function MemoryGrid({
  memoriesPrefix = DEFAULT_MEMORIES_PREFIX,
  onCreateNew,
  onConfigure,
}: Readonly<MemoryGridProps>) {
  const { data: previews, isLoading, error } = useStoreFilePreviews(memoriesPrefix, PREVIEW_CHARS);

  // The store listing is a plain startswith filter, so the personal namespace
  // also returns nested agent rows ("/memories/{slug}/…"): keep only the
  // direct children of THIS namespace ("one scope never merges into another",
  // REQ-012) and address each card by its exact stored path. `.filter()` already
  // returns a fresh array, so the sort below never mutates the query cache.
  const scopedPreviews = useMemo(
    () =>
      (previews ?? [])
        .filter((item) => isDirectMemoryChild(memoriesPrefix, item.path))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [previews, memoriesPrefix],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" data-od-id="memory-grid">
        <span
          className="spin mr-3 inline-block h-4 w-4 border-2 border-border border-t-accent"
          aria-hidden="true"
        />
        <p className="font-mono text-sm text-muted">Loading memories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24" data-od-id="memory-grid">
        <p className="font-mono text-sm text-danger">Failed to load memories: {error.message}</p>
      </div>
    );
  }

  if (scopedPreviews.length === 0) {
    return (
      <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="memory-grid">
        <MemoryCreateButton onClick={onCreateNew} />
      </div>
    );
  }

  return (
    <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="memory-grid">
      {scopedPreviews.map((item) => {
        const name = deriveNameFromPath(item.path, memoriesPrefix);
        const preview =
          item.preview.length > PREVIEW_CHARS
            ? `${item.preview.slice(0, PREVIEW_CHARS)}…`
            : item.preview;
        return (
          // The card itself is the grid item: ResourceCard carries `min-w-0`
          // (review I4) and `h-full`, so track blowout and unequal heights
          // are both impossible. The card reports its FILENAME (frozen card
          // contract); the wrapper hands the EXACT stored path to the page so
          // the Viewer/Delete never retarget a same-named memory of another
          // space (N2).
          <MemoryCard
            key={item.path}
            name={name}
            preview={preview}
            onConfigure={() => onConfigure(item.path)}
          />
        );
      })}
      <MemoryCreateButton onClick={onCreateNew} />
    </div>
  );
}

/**
 * The card label: the path RELATIVE to the namespace prefix — the basename
 * for direct children, the deeper relative path for anything else, and the
 * untouched path when it lives outside the namespace — so the label can never
 * silently re-target a different scope's memory.
 */
function deriveNameFromPath(path: string, prefix: string): string {
  if (path.startsWith(prefix)) {
    const relative = path.slice(prefix.length);
    if (relative) return relative;
  }
  return path;
}

function MemoryCreateButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-od-id="memory-card-new"
      /* No aria-label: the visible label ("New Memory") IS the accessible
         name — keeps it distinct from the page's "Create Memory" action. */
      className="group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-surface/50 text-muted transition-[border-color,color] duration-base ease-standard hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:shadow-focus"
    >
      <span
        className="flex h-12 w-12 items-center justify-center border border-border bg-surface text-muted transition-colors group-hover:border-accent group-hover:text-accent"
        aria-hidden="true"
      >
        <Plus className="h-6 w-6" />
      </span>
      <span className="font-mono text-xs uppercase tracking-[0.1em]">New Memory</span>
    </button>
  );
}
