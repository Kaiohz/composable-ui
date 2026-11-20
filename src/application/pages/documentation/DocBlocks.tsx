import { Link } from "react-router-dom";
import type { Ref } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/application/lib/utils";
import type { DocBlock, DocChapter, DocSpan } from "./content/types";

/**
 * Presentation for the structured documentation content (REQ-017). The
 * chapter's `title` is the <h1> of the page and `sub` blocks render as
 * <h2> subsections, giving the guide a proper heading hierarchy (h1+h2,
 * REQ-015 / Accessibility NFR) that stays stable: chapter subsections are
 * authored data, so screen-reader navigation can jump straight to
 * "Common problems" or any other subsection.
 */

const PARA = "font-body text-sm leading-relaxed text-fg-2 overflow-wrap-anywhere";
const LIST =
  "flex flex-col gap-2 pl-5 font-body text-sm leading-relaxed text-fg-2 marker:text-accent";
const INLINE_LABEL =
  "break-words border border-border-soft bg-surface-warm px-1.5 py-0.5 font-mono text-xs text-fg";
const INLINE_LINK =
  "text-accent underline decoration-accent/60 underline-offset-2 transition-colors duration-fast ease-standard hover:decoration-accent focus-visible:outline-none focus-visible:shadow-focus";

/**
 * Content-based React keys with a per-list occurrence suffix (Sonar S6479 —
 * no array-index keys). Documentation is authored data, so the content key is
 * stable across re-renders; the occurrence suffix keeps legitimately repeated
 * spans (label chips, separators) unique inside one list, so rendering never
 * emits React's duplicate-key warning (BUG-006).
 */
function withStableKeys<T>(
  entries: readonly T[],
  toKey: (entry: T) => string,
): ReadonlyArray<{ readonly key: string; readonly entry: T }> {
  const occurrences = new Map<string, number>();
  return entries.map((entry) => {
    const base = toKey(entry);
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    return { key: occurrence === 0 ? base : `${base}~${occurrence}`, entry };
  });
}

const spanKey = (span: DocSpan): string => JSON.stringify(span);
const spansKey = (spans: readonly DocSpan[]): string => JSON.stringify(spans);
const blockKey = (block: DocBlock): string => `${block.kind}:${JSON.stringify(block)}`;

function DocInline({ spans }: { readonly spans: readonly DocSpan[] }) {
  return (
    <>
      {withStableKeys(spans, spanKey).map(({ key, entry: span }) => {
        if ("l" in span) {
          return (
            <Link key={key} to={span.l.to} className={INLINE_LINK}>
              {span.l.text}
            </Link>
          );
        }
        if ("c" in span) {
          return (
            <code key={key} className={INLINE_LABEL}>
              {span.c}
            </code>
          );
        }
        return <span key={key}>{span.t}</span>;
      })}
    </>
  );
}

function DocBlockView({ block }: { readonly block: DocBlock }) {
  switch (block.kind) {
    case "para":
      return <p className={PARA}>{<DocInline spans={block.spans} />}</p>;
    case "sub":
      return (
        <h2 className="mt-4 border-b border-border-soft pb-1 font-display text-sm uppercase tracking-[0.06em] text-fg first:mt-0">
          {block.text}
        </h2>
      );
    case "steps":
      return (
        <ol className={cn(LIST, "list-decimal")}>
          {withStableKeys(block.items, spansKey).map(({ key, entry: item }) => (
            <li key={key} className={PARA}>
              <DocInline spans={item} />
            </li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul className={cn(LIST, "list-disc")}>
          {withStableKeys(block.items, spansKey).map(({ key, entry: item }) => (
            <li key={key} className={PARA}>
              <DocInline spans={item} />
            </li>
          ))}
        </ul>
      );
    case "warning":
      return (
        <div
          className="flex gap-3 border border-danger bg-danger/10 p-4"
          data-od-id="documentation-warning"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <p className={PARA} role="note" aria-label="Warning">
            <DocInline spans={block.spans} />
          </p>
        </div>
      );
    case "example":
      return (
        <figure
          className="flex min-w-0 flex-col gap-2 border border-border-soft bg-surface-warm p-4"
          data-od-id="documentation-example"
        >
          <figcaption className="font-mono text-xs uppercase tracking-[0.1em] text-muted">
            Example
          </figcaption>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-fg-2">
            <code>{block.lines.join("\n")}</code>
          </pre>
        </figure>
      );
    case "links":
      return (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{block.label}:</p>
          {withStableKeys(block.items, (item) => `${item.to}:${item.text}`).map(
            ({ key, entry: item }) => (
              <Link
                key={key}
                to={item.to}
                className="border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-fg-2 transition-[border-color,color] duration-fast ease-standard hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:shadow-focus"
              >
                {item.text}
              </Link>
            ),
          )}
        </div>
      );
  }
}

/** Renderer for one documentation chapter. */
export function DocChapterView({
  chapter,
  headingRef,
}: {
  readonly chapter: DocChapter;
  /** Receives focus on section change so the switch is announced. */
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8"
      data-od-id={`documentation-chapter-${chapter.slug}`}
    >
      <div>
        <p
          className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-muted"
          aria-hidden="true"
        >
          {chapter.doc}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg uppercase leading-tight tracking-[0.06em] text-fg outline-none md:text-xl"
        >
          {chapter.title}
        </h1>
      </div>
      {withStableKeys(chapter.blocks, blockKey).map(({ key, entry: block }) => (
        <DocBlockView key={key} block={block} />
      ))}
    </div>
  );
}
