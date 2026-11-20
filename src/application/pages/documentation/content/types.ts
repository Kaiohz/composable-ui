/**
 * Structured user-documentation content (spec: add-user-documentation.md).
 *
 * Chapters are presentation-free data: rendering lives in `../DocBlocks.tsx`
 * so adding or revising a chapter never touches the documentation layout
 * (REQ-017). Content is bundled with the frontend — no documentation service
 * is queried at runtime (REQ-012) and nothing in the UI edits it (REQ-013).
 *
 * Writing rules for this folder:
 *  - English only, simple, task-oriented (spec "Confirmed product decisions").
 *  - Explain purpose and when to use a feature before detailed procedures.
 *  - Exact UI labels are wrapped in `lbl(...)` so they stay greppable against
 *    the actual interface.
 *  - Internal links use `docLink(...)` (documentation sections) or app routes
 *    (e.g. "/agents") so cross-references always keep working (REQ-011).
 *  - Never include real credentials, private URLs or personal data; example
 *    values must be clearly fictitious (e.g. `YOUR_API_KEY`).
 */

/** One inline span inside a paragraph, step, bullet or warning. */
export type DocSpan =
  | { readonly t: string }
  | { readonly c: string }
  | { readonly l: { readonly to: string; readonly text: string } };

export type DocLink = { readonly to: string; readonly text: string };

/** A content block inside a chapter. Rendering order is the array order. */
export type DocBlock =
  | { readonly kind: "para"; readonly spans: readonly DocSpan[] }
  /**
   * Subsection label, rendered as an <h2>: together with the chapter's <h1>
   * this gives every chapter the canonical two-level heading hierarchy
   * (screen-reader navigation by chapter and subsection, REQ-015).
   */
  | { readonly kind: "sub"; readonly text: string }
  | { readonly kind: "steps"; readonly items: readonly (readonly DocSpan[])[] }
  | { readonly kind: "bullets"; readonly items: readonly (readonly DocSpan[])[] }
  | { readonly kind: "warning"; readonly spans: readonly DocSpan[] }
  | { readonly kind: "example"; readonly lines: readonly string[] }
  | { readonly kind: "links"; readonly label: string; readonly items: readonly DocLink[] };

export interface DocChapter {
  /** Stable identifier from the spec, e.g. "DOC-03". */
  readonly doc: string;
  /** Stable URL segment under /documentation (REQ-005). */
  readonly slug: string;
  /** Short label shown in the documentation section navigation. */
  readonly navLabel: string;
  /** Full chapter title (the heading of the chapter). */
  readonly title: string;
  readonly blocks: readonly DocBlock[];
}

/* ── Authoring helpers (keep chapter files compact and uniform) ──────────── */

export const txt = (t: string): DocSpan => ({ t });
export const lbl = (c: string): DocSpan => ({ c });
export const docLink = (to: string, text: string): DocSpan => ({ l: { to, text } });

export const para = (...spans: readonly DocSpan[]): DocBlock => ({ kind: "para", spans });
export const sub = (text: string): DocBlock => ({ kind: "sub", text });
export const steps = (...items: readonly DocSpan[][]): DocBlock => ({ kind: "steps", items });
export const bullets = (...items: readonly DocSpan[][]): DocBlock => ({ kind: "bullets", items });
export const warning = (...spans: readonly DocSpan[]): DocBlock => ({ kind: "warning", spans });
export const example = (lines: readonly string[]): DocBlock => ({ kind: "example", lines });
export const links = (label: string, ...items: readonly DocLink[]): DocBlock => ({
  kind: "links",
  label,
  items,
});
