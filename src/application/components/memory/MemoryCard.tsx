import { BookOpen, Settings } from "lucide-react";
import { Button } from "@/application/components/ui/button";
import { ResourceCard, ResourceCardFooter } from "@/application/components/ui/resource-card";

interface MemoryCardProps {
  readonly name: string;
  readonly preview: string;
  /**
   * Invoked with the card's filename when Configure is clicked. The memories
   * grid wraps this callback and swaps in the EXACT stored path (the name is
   * display-only there), so `name` is informational at this boundary.
   */
  readonly onConfigure: (name: string) => void;
}

/**
 * Presentational card for a single memory file, rendered through the shared
 * resource-card composition (spec unify-cards-modals CARD-001..010).
 * `name` is the filename, `preview` is a truncated content preview.
 */
export function MemoryCard({ name, preview, onConfigure }: Readonly<MemoryCardProps>) {
  return (
    <ResourceCard odId={`memory-card-${name}`} icon={BookOpen} title={name}>
      <p className="line-clamp-3 break-words font-mono text-xs text-muted">{preview}</p>

      <ResourceCardFooter>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onConfigure(name)}
          data-od-id={`memory-configure-${name}`}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configure
        </Button>
      </ResourceCardFooter>
    </ResourceCard>
  );
}

export default MemoryCard;
