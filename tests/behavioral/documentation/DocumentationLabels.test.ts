/**
 * Spec: add-user-documentation.md — REQ-010, REQ-018 (label-truth guard).
 *
 * The guide quotes UI labels with `lbl(...)` so its procedures can be
 * verified against the actual interface. This guard fails when a label
 * quoted in a chapter is no longer present in the product's UI sources
 * (a feature label renamed or removed without updating the guide in the
 * same delivery), or when a chapter quotes a label the UI never had —
 * exactly the defect the DOC-10 review caught ("Set a working_dir in the
 * workspace selector first" no longer exists in the application).
 *
 * The check is static by design: it reads the live `src/` sources and the
 * typed chapter registry (no feature mocks, no artificial consumers). It is
 * not a behavioural test — it is the maintenance guarantee REQ-018 asks for.
 * Beyond label presence, QA regressions found in browser review are locked
 * down by dedicated canaries at the end of this file (removed RAG guard
 * string, DOC-10 selector location, DOC-02 chat activity labels, DOC-03 the
 * "Agent Name" field, DOC-05 the real Models create entry points, DOC-01 the
 * Model glossary line and the LLM-Settings connection).
 *
 * Documented example values (fictitious names, counts with interpolated
 * values, stand-in credentials) are guide content, not UI labels, so they
 * are explicitly allow-listed below instead of being matched against the
 * sources. Limitation to be aware of: the fuzzy case-insensitive fallback
 * can match comments in the sources; the canaries above cover the concrete
 * drift cases seen in QA.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOC_CHAPTERS,
  DOC_LANDING_SLUG,
} from "../../../src/application/pages/documentation/content";
import type {
  DocBlock,
  DocChapter,
  DocSpan,
} from "../../../src/application/pages/documentation/content/types";

/** Every UI-label-ish value the guide quotes, extracted from the registry. */
function labelsOf(blocks: readonly DocBlock[]): string[] {
  const labels: string[] = [];
  const walk = (spans: readonly DocSpan[]) => {
    for (const span of spans) if ("c" in span) labels.push(span.c);
  };
  for (const block of blocks) {
    if (block.kind === "para" || block.kind === "warning") walk(block.spans);
    if (block.kind === "steps" || block.kind === "bullets") {
      for (const item of block.items) walk(item);
    }
  }
  return labels;
}

/** Concatenated renderable text of a chapter (title, subs, prose, examples). */
function textOf(chapter: DocChapter): string {
  let text = chapter.title;
  const walk = (spans: readonly DocSpan[]) => {
    for (const span of spans) {
      if ("t" in span) text += span.t;
      if ("c" in span) text += span.c;
      if ("l" in span) text += span.l.text;
    }
  };
  for (const block of chapter.blocks) {
    if (block.kind === "sub") text += block.text;
    if (block.kind === "para" || block.kind === "warning") walk(block.spans);
    if (block.kind === "steps" || block.kind === "bullets") {
      for (const item of block.items) walk(item);
    }
    if (block.kind === "example") text += block.lines.join(" ");
    if (block.kind === "links") text += block.label;
  }
  return text;
}

/** Internal link targets the guide asks the reader to follow. */
function linkTargetsOf(blocks: readonly DocBlock[]): string[] {
  const targets: string[] = [];
  const walk = (spans: readonly DocSpan[]) => {
    for (const span of spans) if ("l" in span) targets.push(span.l.to);
  };
  for (const block of blocks) {
    if (block.kind === "para" || block.kind === "warning") walk(block.spans);
    if (block.kind === "steps" || block.kind === "bullets") {
      for (const item of block.items) walk(item);
    }
    if (block.kind === "links") {
      for (const item of block.items) targets.push(item.to);
    }
  }
  return targets;
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

/** Every guide label, de-duplicated in registry order. */
const DOCUMENTED_LABELS = [...new Set(DOC_CHAPTERS.flatMap((chapter) => labelsOf(chapter.blocks)))];

const UI_SOURCE_FILES = listSourceFiles(join(process.cwd(), "src")).filter(
  // Exclude the guide itself from the label corpus: otherwise the chapters
  // are self-matching and this guard can never fail.
  (file) => !file.includes(join("application", "pages", "documentation")),
);
const UI_SOURCE = UI_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
const UI_SOURCE_LOWER = UI_SOURCE.toLowerCase();

const APP_ROUTER_SOURCE = readFileSync(join(process.cwd(), "src/application/App.tsx"), "utf8");

/**
 * Labels the guide quotes that are documentation content rather than UI
 * literals: toasts the UI renders with interpolated names/counts, format
 * examples and fictitious stand-in values. Everything NOT in this list must
 * exist in `src/`, so a real label's removal breaks this guard (REQ-018).
 */
const DOCUMENTED_EXAMPLE_LABELS: readonly string[] = [
  // Toast/status texts the UI renders with interpolated names or counts.
  'Prompt "name" deleted',
  'Prompt "name" created',
  'Model "name" deleted',
  'Agent "name" deleted',
  'Cron "name" created',
  'Cron "name" updated',
  'Cron "name" deleted',
  "Version N created",
  "Version N",
  "Version 1",
  "✓ 5 tools",
  "3 files uploaded successfully",
  "5 uploaded, 2 failed",
  "Delete <name>",
  // Format examples and fictional counters (rendered dynamically by the UI).
  "Page X / N",
  // One-time display of a masked key: the value part is a stand-in.
  "Current key: sk-***1234",
  // Documented stand-in credentials.
  "YOUR_API_KEY",
  // Documented example time zones the form accepts but never prints.
  "Europe/Paris",
  "America/New_York",
  // Fictitious workspace/agent names used as examples in steps.
  "daily-digest",
  "AGENTS",
  // Example renderings of dynamic patterns (the UI prints the pattern with
  // an interpolated name): `Calling tool: {name}`.
  "Calling tool: send_email",
  "Summarize the day's releases.",
  "name — Version history",
  "v2",
  "Failed to load skill: …",
];

describe("Documentation label contract (REQ-010, REQ-018)", () => {
  it.each(DOCUMENTED_LABELS)('keeps the guide label "%s" present in the UI sources', (label) => {
    if (DOCUMENTED_EXAMPLE_LABELS.includes(label)) {
      expect(DOCUMENTED_EXAMPLE_LABELS, `allow-listed example: ${label}`).toContain(label);
      return;
    }
    expect(
      UI_SOURCE.includes(label) || UI_SOURCE_LOWER.includes(label.toLowerCase()),
      `the guide quotes "${label}" but no UI source in src/ contains it — correct the chapter in the same delivery (REQ-018)`,
    ).toBe(true);
  });

  it("never re-quotes the removed RAG working-directory guard string", () => {
    const removed = "Set a working_dir in the workspace selector first";
    for (const chapter of DOC_CHAPTERS) {
      expect(
        textOf(chapter),
        `${chapter.doc} must not resurrect the removed guard string`,
      ).not.toContain(removed);
    }
  });

  it("tells the reader where the Workspace selector lives in the DOC-10 indexing procedure", () => {
    const rag = DOC_CHAPTERS.find((chapter) => chapter.slug === "rag-storage");
    expect(rag, "the RAG Storage chapter must stay registered").toBeDefined();
    const ragText = textOf(rag as DocChapter);
    const start = ragText.indexOf("Index files so they can be searched");
    const end = ragText.indexOf("Ask a question", start);
    expect(start, "the DOC-10 indexing section must stay present").toBeGreaterThan(-1);
    expect(
      end,
      "the DOC-10 indexing section must be followed by the query section",
    ).toBeGreaterThan(start);
    const indexingSection = ragText.slice(start, end);
    expect(indexingSection).toContain("Workspace (working directory)");
    // BUG-002 regression guard: the selector is rendered on the Query tab
    // only, so the indexing procedure must say where to find it and must
    // never present it as an element of the Browse flow.
    expect(indexingSection).toContain("Query tab");
    // BUG-005 regression guard (QA-measured QueryPanel geometry): the
    // selector shares the bottom row with `Search`, immediately to its left —
    // no wording may ever claim it sits *above* the search box or the button.
    expect(indexingSection).toContain("same bottom row");
    expect(ragText).not.toContain("directly above the");
    expect(ragText).not.toContain("above the search box");
  });

  it("quotes only chat activity labels the chat screen prints in DOC-02", () => {
    const chat = DOC_CHAPTERS.find((chapter) => chapter.slug === "orchestration-and-chat");
    expect(chat, "the Orchestration and Chat chapter must stay registered").toBeDefined();
    const chatText = textOf(chat as DocChapter);
    // BUG-003 regression guard: the chat prints `Calling tool: {name}` and
    // `Tool Result` — never "Tool call" / "Tool result".
    expect(chatText).not.toContain("Tool call");
    expect(chatText).not.toContain("Tool result");
    expect(chatText).toContain("Calling tool:");
    expect(chatText).toContain("Tool Result");
  });

  it('names the agent name field "Agent Name" in DOC-03', () => {
    const agents = DOC_CHAPTERS.find((chapter) => chapter.slug === "agents");
    expect(agents, "the Agents chapter must stay registered").toBeDefined();
    const agentsText = textOf(agents as DocChapter);
    // BUG-004 regression guard: the Create Agent dialog labels its first
    // field "Agent Name" — never the generic "Name".
    expect(agentsText).toContain("Agent Name");
    expect(agentsText).not.toMatch(/enter the Name\b/);
  });

  it("describes only the real create entry points in the DOC-05 Models procedure", () => {
    const models = DOC_CHAPTERS.find((chapter) => chapter.slug === "models");
    expect(models, "the Models chapter must stay registered").toBeDefined();
    const modelsText = textOf(models as DocChapter);
    // QA BUG-002 regression guard: the Models grid renders the model cards
    // only — no dashed create tile exists on that page. The real entry
    // points are the "New Model" header button and the empty state's
    // "Create Model" button, so the procedure must name those and never a
    // dashed tile.
    expect(modelsText).not.toContain("dashed");
    expect(modelsText).toContain("New Model");
    expect(modelsText).toContain("Create Model");
  });

  it("does not describe a Model as naming a provider in DOC-01 Getting Started", () => {
    const gettingStarted = DOC_CHAPTERS.find((chapter) => chapter.slug === "getting-started");
    expect(gettingStarted, "the Getting Started chapter must stay registered").toBeDefined();
    const gettingStartedText = textOf(gettingStarted as DocChapter);
    // QA BUG-003 regression guard: a Model is identity-only (display name +
    // provider_model) and carries no provider — the provider connection is
    // LLM Settings data, which the glossary line must state.
    expect(gettingStartedText).not.toMatch(/names?\s+a\s+provider/i);
    expect(gettingStartedText).toContain("LLM Settings");
  });
});

describe("Documentation link targets (REQ-011)", () => {
  it("resolves every internal link in the guide to a real section or app route", () => {
    const targets = [...new Set(DOC_CHAPTERS.flatMap((chapter) => linkTargetsOf(chapter.blocks)))];
    expect(targets.length, "the guide should contain internal links").toBeGreaterThan(0);

    for (const target of targets) {
      if (target.startsWith("/documentation/")) {
        const segment = target.slice("/documentation/".length);
        expect(
          DOC_CHAPTERS.some((chapter) => chapter.slug === segment),
          `${target} must map to a registered chapter`,
        ).toBe(true);
      } else if (target === "/documentation") {
        expect(DOC_LANDING_SLUG).toBe("getting-started");
      } else {
        expect(APP_ROUTER_SOURCE, `${target} must still be a declared app route`).toMatch(
          new RegExp(`path="${target}`),
        );
      }
    }
  });
});
