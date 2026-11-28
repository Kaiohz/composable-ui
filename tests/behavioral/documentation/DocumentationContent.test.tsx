/**
 * Spec: add-user-documentation.md — REQ-007, REQ-008, REQ-009, REQ-010, REQ-012,
 * REQ-013.
 *
 * Behavioral entry point: the REAL application router (`@/application/App`)
 * rendered under BrowserRouter + a real QueryClientProvider (same providers as
 * src/application/main.tsx). Each section is reached through its real client
 * route — the same journey a user makes from a bookmark or deep link.
 *
 * Content contract per section (REQ-007/008): finished, substantive functional
 * prose — no placeholders, TODOs, lorem ipsum, or empty chapters. Required
 * topics per section (DOC-01..DOC-12) are asserted with representative
 * keywords drawn from the spec's information architecture.
 *
 * Step-1 (Red): no /documentation routes exist, so nothing renders and every
 * chapter query fails until the documentation feature is implemented.
 */
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppRoot from "@/application/App";

type Chapter = {
  doc: string;
  slug: string;
  title: RegExp;
  /** Representative plain-language topics the chapter must actually cover. */
  requiredTopics: RegExp[];
};

const CHAPTERS: readonly Chapter[] = [
  {
    doc: "DOC-01",
    slug: "getting-started",
    title: /getting started/i,
    requiredTopics: [/agent/i, /prompt/i, /model/i, /conversation/i, /memory|skill/i, /trace/i],
  },
  {
    doc: "DOC-02",
    slug: "orchestration-and-chat",
    title: /threads/i,
    requiredTopics: [/message/i, /thread/i, /approv|reject|review/i, /attach/i],
  },
  {
    doc: "DOC-03",
    slug: "agents",
    title: /agents/i,
    requiredTopics: [
      /prompt/i,
      /model/i,
      /tool/i,
      /subagent/i,
      /human-in-the-loop|approval/i,
      /pin|latest/i,
    ],
  },
  {
    doc: "DOC-04",
    slug: "prompts",
    title: /prompts/i,
    requiredTopics: [/version/i, /immutable|new version/i, /delete/i, /agent/i],
  },
  {
    doc: "DOC-05",
    slug: "models",
    title: /models/i,
    requiredTopics: [/provider/i, /credential|api key/i, /delete|in use/i],
  },
  {
    doc: "DOC-06",
    slug: "crons",
    title: /crons/i,
    requiredTopics: [/schedule|cron/i, /timezone/i, /run now|immediate/i, /status|history/i],
  },
  {
    doc: "DOC-07",
    slug: "traces",
    title: /traces/i,
    requiredTopics: [/dashboard/i, /runs|threads/i, /cost|token/i, /filter|period/i, /duration/i],
  },
  {
    doc: "DOC-08",
    slug: "skills",
    title: /skills/i,
    requiredTopics: [/skill/i, /instruction/i, /agent/i, /delete|export/i],
  },
  {
    doc: "DOC-09",
    slug: "memories",
    title: /memories/i,
    requiredTopics: [/memory/i, /markdown/i, /agent/i, /delete/i],
  },
  {
    doc: "DOC-10",
    slug: "rag-storage",
    title: /rag storage/i,
    requiredTopics: [/upload/i, /folder/i, /index/i, /quer/i, /working directory/i],
  },
  {
    doc: "DOC-11",
    slug: "mcp-registry",
    title: /mcp registry/i,
    requiredTopics: [/server/i, /register|add/i, /validat|connect/i, /endpoint|url/i],
  },
  {
    doc: "DOC-12",
    slug: "settings",
    title: /settings/i,
    requiredTopics: [/theme|appearance/i, /llm|provider/i, /api key/i, /revoke|sign out|reset/i],
  },
];

const PLACEHOLDER_PATTERN =
  /lorem ipsum|TODO\b|FIXME|\bplaceholder\b|coming soon|under construction|work in progress|\[insert|xxx to be/i;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderAppAt(path: string) {
  window.history.replaceState({}, "", path);
  const queryClient = createTestQueryClient();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/documentation");
});

afterEach(() => {
  window.history.replaceState({}, "", "/documentation");
});

describe("Documentation content — every required chapter exists with finished prose", () => {
  it.each(CHAPTERS.map((c) => [c.doc, c]))(
    "%s renders substantive finished content at its section route",
    async (_doc, chapter: Chapter) => {
      // Act — open the chapter directly via its stable URL.
      renderAppAt(`/documentation/${chapter.slug}`);

      // Assert — the chapter renders under a heading.
      await screen.findByRole("heading", { name: chapter.title });
      const mainPane = screen.getByRole("main");
      const text = mainPane.textContent ?? "";

      // Substantive, finished prose — not an empty chapter or a stub.
      expect(text.length, `${chapter.doc} should contain substantive guidance`).toBeGreaterThan(
        500,
      );

      // No placeholders of any kind.
      const placeholders = text.match(new RegExp(PLACEHOLDER_PATTERN.source, "gi"));
      expect(placeholders, `${chapter.doc} must not contain placeholder copy`).toBeNull();

      // The spec's required topics for this chapter are covered.
      for (const topic of chapter.requiredTopics) {
        expect(text, `${chapter.doc} should cover ${topic}`).toMatch(topic);
      }
    },
  );

  it("presents Getting Started as the default landing section with the core mental model", async () => {
    renderAppAt("/documentation");

    await screen.findByRole("heading", { name: /getting started/i });
    const mainPane = screen.getByRole("main");
    const text = mainPane.textContent ?? "";

    // The overview explains how the pieces fit together before procedures.
    for (const concept of [/agent/i, /conversation/i, /prompt/i, /model/i, /settings/i]) {
      expect(text).toMatch(concept);
    }
  });

  it("does not offer in-app editing of documentation content", async () => {
    renderAppAt("/documentation/getting-started");

    await screen.findByRole("heading", { name: /getting started/i });

    const mainPane = screen.getByRole("main");
    expect(within(mainPane).queryByRole("textbox")).toBeNull();
    expect(within(mainPane).queryByRole("button", { name: /save|edit|publish/i })).toBeNull();
  });

  it("keeps examples clearly fictitious (never real-looking credentials)", async () => {
    // Scan a sample of chapters that carry examples for secret leakage.
    for (const slug of ["getting-started", "mcp-registry", "settings"]) {
      const { unmount } = renderAppAt(`/documentation/${slug}`);
      // The chapter renders under its heading hierarchy (h1 + subsections).
      await screen.findAllByRole("heading");
      const mainPane = screen.getByRole("main");
      const text = mainPane.textContent ?? "";

      expect(
        text,
        "documentation examples must never contain real-looking private keys or tokens",
      ).not.toMatch(
        /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/,
      );

      unmount();
    }
  });
});
