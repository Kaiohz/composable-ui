import { Zap } from "lucide-react";
import { Button } from "@/application/components/ui/button";

interface IndexActionMenuProps {
  onIndexClassical: () => void;
  /**
   * Accessible name override for rows that need disambiguation (e.g. a folder
   * row next to file rows must not answer the exact "Index" query). The
   * visible text stays "Index" so the override always contains it
   * (WCAG label-in-name).
   */
  ariaLabel?: string;
  /** Id of the element describing WHICH row the action applies to. */
  ariaDescribedBy?: string;
}

export default function IndexActionMenu({
  onIndexClassical,
  ariaLabel = "Index",
  ariaDescribedBy,
}: Readonly<IndexActionMenuProps>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onIndexClassical}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
      Index
    </Button>
  );
}
