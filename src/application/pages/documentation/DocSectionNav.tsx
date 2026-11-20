import { Link } from "react-router-dom";
import { cn } from "@/application/lib/utils";
import { DOC_CHAPTERS } from "./content";

interface DocSectionNavProps {
  /** Mobile disclosure state; on desktop (lg+) the nav is always displayed. */
  readonly open: boolean;
  /** Slug of the currently resolved section (default included). */
  readonly currentSlug: string;
  /** Id used by the disclosure button's aria-controls. */
  readonly id: string;
  /** Called when a section link is activated, to collapse the mobile panel. */
  readonly onSectionSelect: () => void;
}

/**
 * Section navigation for the user guide (REQ-004, REQ-006, REQ-014).
 * Twelve stable links with `aria-current="page"` on the active section and
 * the app's accent-link active convention. Hidden on mobile unless the
 * "Sections" disclosure is expanded; always visible from lg breakpoints up.
 */
export default function DocSectionNav({
  open,
  currentSlug,
  id,
  onSectionSelect,
}: Readonly<DocSectionNavProps>) {
  return (
    <nav
      id={id}
      aria-label="Documentation sections"
      data-od-id="documentation-sections"
      className={cn(
        "hidden overflow-y-auto border-b border-border bg-surface p-3 lg:flex lg:min-h-0 lg:flex-col lg:gap-1 lg:border-b-0 lg:border-r lg:border-border lg:p-4",
        open && "flex",
      )}
    >
      {DOC_CHAPTERS.map((chapter) => {
        const active = chapter.slug === currentSlug;
        return (
          <Link
            key={chapter.slug}
            to={`/documentation/${chapter.slug}`}
            aria-current={active ? "page" : undefined}
            data-od-id={`documentation-section-${chapter.slug}`}
            onClick={onSectionSelect}
            className={cn(
              "border border-transparent border-l-[3px] border-l-transparent px-3 py-2.5 font-body text-sm transition-[background-color,border-color,color] duration-fast ease-standard focus-visible:outline-none focus-visible:shadow-focus",
              active
                ? "border-l-accent bg-surface-warm text-accent"
                : "text-fg-2 hover:bg-surface-warm hover:text-fg",
            )}
          >
            {chapter.navLabel}
          </Link>
        );
      })}
    </nav>
  );
}
