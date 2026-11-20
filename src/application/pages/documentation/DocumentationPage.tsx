import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Book, Menu, ScrollText } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import { Button } from "@/application/components/ui/button";
import { useSidebarStore } from "@/application/stores/useSidebarStore";
import { cn } from "@/application/lib/utils";
import { DOC_LANDING_SLUG, getChapterBySlug } from "./content";
import DocSectionNav from "./DocSectionNav";
import { DocChapterView } from "./DocBlocks";

const SECTION_NAV_ID = "documentation-sections";

/**
 * In-app user documentation area (spec: add-user-documentation.md).
 *
 * Layout conventions:
 *  - Rendered inside the app's AppShell so the global left menu keeps working
 *    (REQ-014); the route provides its own in-view header instead of the
 *    standard MainHeader (AppShell `hideHeader`) so the guide's heading
 *    structure starts with the chapter title itself.
 *  - One heading per page: the chapter <h1> is the only heading; subsections
 *    are styled paragraphs (see DocBlocks.tsx).
 *  - The reading route is bundled and lazy-loaded like other secondary
 *    routes; no API is involved in reading or navigating content (REQ-012).
 *
 * Test-relevant contract (tests/behavioral/documentation):
 *  - `nav` carries the accessible name "Documentation sections".
 *  - Mobile section selection is disclosed by a button with
 *    `aria-expanded`/`aria-controls`; after a section is selected the
 *    selection UI collapses so the content is not covered (aria-expanded
 *    returns to "false").
 *  - Unknown URLs render a safe not-found state with a working route back
 *    to Getting Started.
 */
export default function DocumentationPage() {
  const params = useParams<{ sectionSlug?: string; "*": string }>();
  // Three routes share this page: `/documentation` (no param — landing),
  // `/documentation/:sectionSlug` (single segment) and the catch-all
  // `/documentation/*`, whose splat carries the unmatched remainder (single
  // or nested). Nested remainders like "agents/versions" resolve to no
  // chapter, so the safe not-found fallback renders (BUG-001).
  const splatSlug = params["*"] || undefined;
  const sectionSlug = params.sectionSlug ?? splatSlug;
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const chapter = getChapterBySlug(sectionSlug);

  // The mobile section selection is disclosed per section: the selection UI
  // is open only while the user has disclosed it for the CURRENT section, so
  // any section change (link click, cross-reference, browser Back/Forward)
  // collapses it and the reading content stays uncovered (REQ-014). Derived
  // during render — no effect needed.
  const currentSlug = sectionSlug ?? DOC_LANDING_SLUG;
  const sectionsOpen = openSlug === currentSlug;
  const discloseSections = () => setOpenSlug(currentSlug);
  const collapseSections = () => setOpenSlug(null);

  // The reading pane is one stable DOM node across section changes
  // (`stableView`), so its scroll offset survives navigation; reset it for
  // every resolved chapter, and move focus to the chapter heading so the
  // content change is announced to assistive technology without disturbing
  // keyboard behaviour (the h1 keeps focus until the next Tab).
  useEffect(() => {
    const pane = articleRef.current;
    if (pane) pane.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [currentSlug]);

  if (chapter == null) {
    return <DocumentationNotFound />;
  }

  return (
    <AppShell hideHeader stableView>
      <div className="flex h-full min-h-0 flex-col" data-od-id="documentation-view">
        <DocumentationTopBar>
          <button
            type="button"
            onClick={discloseSections}
            aria-expanded={sectionsOpen}
            aria-controls={SECTION_NAV_ID}
            data-od-id="documentation-sections-toggle"
            className={cn(
              "flex items-center gap-2 border border-border bg-surface px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] text-fg-2",
              "transition-[border-color,color] duration-fast ease-standard hover:border-accent hover:text-accent",
              "focus-visible:outline-none focus-visible:shadow-focus lg:hidden",
            )}
          >
            <ScrollText className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sections
          </button>
        </DocumentationTopBar>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
          <DocSectionNav
            open={sectionsOpen}
            currentSlug={chapter.slug}
            id={SECTION_NAV_ID}
            onSectionSelect={collapseSections}
          />
          <article
            ref={articleRef}
            className="min-h-0 overflow-y-auto bg-bg"
            data-od-id="documentation-article"
            aria-label="Documentation content"
          >
            <DocChapterView chapter={chapter} headingRef={headingRef} />
          </article>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * In-view page header for the documentation area. On mobile it also carries
 * the global-menu button so the off-canvas left menu stays reachable
 * (mirrors MainHeader's mobile entry point but without an <h1>, which is
 * owned by the chapter content).
 */
function DocumentationTopBar({ children }: Readonly<{ children?: React.ReactNode }>) {
  const open = useSidebarStore((s) => s.open);
  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-6"
      data-od-id="documentation-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={open}
          className="shrink-0 md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 items-center gap-2" data-od-id="documentation-header-title">
          <Book className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate font-display text-base uppercase tracking-[0.06em] text-fg">
            User <span className="text-accent">Guide</span>
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Safe fallback for unknown documentation URLs (Error Cases). */
function DocumentationNotFound() {
  return (
    <AppShell hideHeader stableView>
      <div className="flex h-full min-h-0 flex-col" data-od-id="documentation-not-found-view">
        <DocumentationTopBar />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-bg p-6">
          <section
            className="flex max-w-md flex-col gap-4 border border-border bg-surface p-8 text-center block-shadow"
            data-od-id="documentation-not-found"
          >
            <h1 className="font-display text-base uppercase tracking-[0.06em] text-fg">
              Section not found
            </h1>
            <p className="font-body text-sm leading-relaxed text-muted">
              There is no documentation section at this address. The section may have been renamed
              or the link may be mistyped. Return to the start of the guide to keep reading.
            </p>
            <div className="flex justify-center">
              <Link
                to={`/documentation/${DOC_LANDING_SLUG}`}
                data-od-id="documentation-not-found-back"
                className="border border-border bg-surface-warm px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-fg-2 transition-[border-color,color] duration-fast ease-standard hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:shadow-focus"
              >
                Getting Started
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
