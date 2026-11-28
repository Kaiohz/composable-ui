/**
 * Spec: add-user-documentation.md — REQ-003, REQ-004, REQ-005, REQ-006, REQ-011,
 * REQ-014, REQ-15 (keyboard), Error Cases (unknown section).
 *
 * Behavioral entry point: the REAL application router (`@/application/App`,
 * default export `AppRoot`) rendered under BrowserRouter + a real
 * QueryClientProvider, exactly like production (`src/application/main.tsx`).
 * Tests drive real client-side navigation (link clicks, browser Back and
 * Forward) — no page or route stubs of the documentation feature.
 *
 * Documentation section URL contract (stable per-section routes, REQ-005):
 *
 *   /documentation                      → DOC-01 Getting Started (landing/default)
 *   /documentation/getting-started      → DOC-01
 *   /documentation/orchestration-and-chat → DOC-02
 *   /documentation/agents               → DOC-03
 *   /documentation/prompts              → DOC-04
 *   /documentation/models               → DOC-05
 *   /documentation/crons                → DOC-06
 *   /documentation/traces               → DOC-07
 *   /documentation/skills               → DOC-08
 *   /documentation/memories             → DOC-09
 *   /documentation/rag-storage          → DOC-10
 *   /documentation/mcp-registry         → DOC-11
 *   /documentation/settings             → DOC-12
 *
 * Presentation contract used by these tests (implementation must satisfy it):
 *  - The documentation section navigation is a <nav> whose accessible name
 *    contains "Documentation" (it must be distinguishable from the global
 *    "Primary navigation" sidebar).
 *  - The current section is identifiable in that navigation (aria-current="page"
 *    or the app's accent active-class convention).
 *  - On narrow layouts the section navigation can be disclosed via a
 *    button carrying aria-expanded (see "Mobile" test); after a section is
 *    selected the selection UI collapses so the content is not covered.
 *
 * Step-1 (Red): no /documentation route exists in App.tsx, so nothing renders
 * at any documentation URL.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppRoot from "@/application/App";

type Section = {
  slug: string;
  /** Regex matched (case-insensitive) against a heading of the chapter. */
  title: RegExp;
};

export const DOC_SECTIONS: readonly Section[] = [
  { slug: "getting-started", title: /getting started/i },
  { slug: "orchestration-and-chat", title: /threads/i },
  { slug: "agents", title: /agents/i },
  { slug: "prompts", title: /prompts/i },
  { slug: "models", title: /models/i },
  { slug: "crons", title: /crons/i },
  { slug: "traces", title: /traces/i },
  { slug: "skills", title: /skills/i },
  { slug: "memories", title: /memories/i },
  { slug: "rag-storage", title: /rag storage/i },
  { slug: "mcp-registry", title: /mcp registry/i },
  { slug: "settings", title: /settings/i },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders the real application router starting at `path`, mirroring
 * src/application/main.tsx (QueryClientProvider + BrowserRouter + App).
 * Direct-URL rendering at a documentation path exercises the same client
 * route resolution a page refresh performs after the SPA shell loads.
 */
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

async function getSectionNav() {
  const nav = await screen.findByRole("navigation", { name: /documentation/i });
  return nav;
}

function expectCurrentSection(link: HTMLElement) {
  const markedCurrent =
    link.getAttribute("aria-current") === "page" ||
    /accent/.test(link.className) ||
    /active/i.test(link.className);
  expect(markedCurrent, "selected section must be visibly identifiable").toBe(true);
}

beforeEach(() => {
  window.history.replaceState({}, "", "/documentation");
});

afterEach(() => {
  window.history.replaceState({}, "", "/documentation");
});

describe("Documentation routing", () => {
  it("opens the in-app documentation on the Getting Started section at the landing route", async () => {
    // Act — direct entry at the landing route (what clicking the sidebar
    // Documentation item resolves to).
    renderAppAt("/documentation");

    // Assert — Getting Started is presented as the default section.
    const heading = await screen.findByRole("heading", { name: /getting started/i });
    expect(heading).toBeInTheDocument();
  });

  it("provides a distinct documentation section navigation alongside the reading pane", async () => {
    renderAppAt("/documentation");

    const sectionNav = await getSectionNav();

    // All twelve required sections are available in the section navigation,
    // in a logical order (Getting Started first, Settings last).
    const linkLabels = within(sectionNav)
      .getAllByRole("link")
      .map((link) => link.textContent ?? "");
    expect(linkLabels.length).toBeGreaterThanOrEqual(12);
    expect(linkLabels[0]).toMatch(/getting started/i);
    const labelSet = linkLabels.join(" ").toLowerCase();
    for (const { slug: _slug, title } of DOC_SECTIONS) {
      const source = title.source.replace(/\\/g, "").replace(/\^|\$/g, "");
      expect(
        labelSet.includes(source.toLowerCase().replace(/\\s\+/g, " ")),
        `section navigation should offer: ${source}`,
      ).toBe(true);
    }
  });

  it("has a stable client-side URL for every section (direct URL + refresh within the client router)", async () => {
    for (const { slug, title } of DOC_SECTIONS) {
      // Act — deep-link straight to the section route (fresh client
      // resolution, equivalent to a refresh/bookmark load).
      const { unmount } = renderAppAt(`/documentation/${slug}`);

      // Assert — the expected section is displayed.
      const heading = await screen.findByRole("heading", { name: title });
      expect(heading, `direct URL /documentation/${slug}`).toBeInTheDocument();

      unmount();
    }
  });

  it("marks the current section in the section navigation", async () => {
    renderAppAt("/documentation/agents");

    const sectionNav = await getSectionNav();
    const agentsLink = within(sectionNav).getByRole("link", {
      name: /^agents/i,
    });

    expectCurrentSection(agentsLink);

    // …and a different section is not marked as current at the same time.
    const gettingStartedLink = within(sectionNav).getByRole("link", {
      name: /getting started/i,
    });
    expect(gettingStartedLink.getAttribute("aria-current")).not.toBe("page");
  });

  it("navigates between sections with client-side routing (no full page reload)", async () => {
    const user = userEvent.setup();
    renderAppAt("/documentation");

    const sectionNav = await getSectionNav();

    // Act — click through: Getting Started → Agents → Crons.
    await user.click(within(sectionNav).getByRole("link", { name: /^agents/i }));
    expect(await screen.findByRole("heading", { name: /^agents/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/documentation/agents");

    await user.click(within(sectionNav).getByRole("link", { name: /crons/i }));
    expect(await screen.findByRole("heading", { name: /crons/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/documentation/crons");

    // Assert — section navigation still shows Crons as current after switching.
    expectCurrentSection(within(sectionNav).getByRole("link", { name: /crons/i }));
  });

  it("preserves sections across browser Back and Forward", async () => {
    const user = userEvent.setup();
    renderAppAt("/documentation");

    const sectionNav = await getSectionNav();

    await user.click(within(sectionNav).getByRole("link", { name: /^agents/i }));
    await screen.findByRole("heading", { name: /^agents/i });
    await user.click(within(sectionNav).getByRole("link", { name: /traces/i }));
    await screen.findByRole("heading", { name: /traces/i });

    // Back: Traces → Agents → Getting Started (landing).
    window.history.back();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^agents/i })).toBeInTheDocument(),
    );
    expectCurrentSection(within(sectionNav).getByRole("link", { name: /^agents/i }));

    window.history.back();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /getting started/i })).toBeInTheDocument(),
    );

    // Forward: Getting Started → Agents → restore active state.
    window.history.forward();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^agents/i })).toBeInTheDocument(),
    );
    window.history.forward();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /traces/i })).toBeInTheDocument(),
    );
    expectCurrentSection(within(sectionNav).getByRole("link", { name: /traces/i }));
  });

  it("shows a safe fallback with a route back to Getting Started for unknown section URLs", async () => {
    renderAppAt("/documentation/does-not-exist");

    // Assert — a not-found state is offered (not a blank screen or crash).
    const fallbackHeading = await screen.findByRole("heading", {
      name: /not found|unknown|does not exist|page not available/i,
    });
    expect(fallbackHeading).toBeInTheDocument();

    // …with a working route back to Getting Started.
    const user = userEvent.setup();
    const backLink = screen.getByRole("link", { name: /getting started/i });
    await user.click(backLink);
    expect(await screen.findByRole("heading", { name: /getting started/i })).toBeInTheDocument();
  });

  it("renders the same fallback for a nested unknown documentation path (not a blank page)", async () => {
    // BUG-001: multi-segment paths like /documentation/agents/versions match
    // no single-segment route; the catch-all must land on the safe fallback.
    renderAppAt("/documentation/agents/versions");

    const fallbackHeading = await screen.findByRole("heading", {
      name: /section not found/i,
    });
    expect(fallbackHeading).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="documentation-not-found"]')).not.toBeNull();

    // …and the route back to Getting Started keeps working from there.
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: /getting started/i }));
    expect(await screen.findByRole("heading", { name: /getting started/i })).toBeInTheDocument();
  });

  it("keeps section links keyboard operable with visible focus", async () => {
    const user = userEvent.setup();
    renderAppAt("/documentation");

    const sectionNav = await getSectionNav();
    const agentsLink = within(sectionNav).getByRole("link", { name: /^agents/i });

    // Act — keyboard activation of a section link.
    agentsLink.focus();
    expect(document.activeElement).toBe(agentsLink);
    await user.keyboard("{Enter}");

    // Assert — the section opens.
    expect(await screen.findByRole("heading", { name: /^agents/i })).toBeInTheDocument();
  });

  it("moves focus to the chapter heading on section change so the switch is announced", async () => {
    const user = userEvent.setup();
    renderAppAt("/documentation");

    const sectionNav = await getSectionNav();

    // Act — switch to another section.
    await user.click(within(sectionNav).getByRole("link", { name: /crons/i }));

    // Assert — the new chapter's heading receives focus (screen readers
    // announce it) without disturbing keyboard behaviour.
    const heading = await screen.findByRole("heading", { name: /crons/i });
    expect(document.activeElement).toBe(heading);
  });

  it("collapses the mobile section navigation after a selection so content is not covered", async () => {
    const user = userEvent.setup();
    renderAppAt("/documentation");

    const sectionNav = await getSectionNav();

    // Mobile contract: the section navigation is disclosed via a control
    // carrying aria-expanded (mirrors the app's existing mobile drawer
    // pattern). Find that disclosure control.
    const disclosure = document.querySelector<HTMLButtonElement>(
      "button[aria-expanded][aria-controls], button[aria-expanded][aria-haspopup]",
    );
    expect(disclosure, "section navigation needs a disclosure control on mobile").not.toBeNull();
    await user.click(disclosure as HTMLButtonElement);
    expect(disclosure as HTMLButtonElement).toHaveAttribute("aria-expanded", "true");

    // Act — select a section from the opened navigation.
    await user.click(within(sectionNav).getByRole("link", { name: /memories/i }));

    // Assert — the section content is readable (present and visible)…
    const heading = await screen.findByRole("heading", { name: /memories/i });
    expect(heading).toBeVisible();

    // …and the selection UI has collapsed so it no longer overlays the content.
    expect(disclosure as HTMLButtonElement).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes representative working cross-references between documentation sections", async () => {
    const user = userEvent.setup();
    renderAppAt("/documentation");

    // Getting Started must reference the detailed chapters with working
    // internal links (REQ-011 representative check).
    const mainPane = await screen.findByRole("main");
    const internalDocLinks = within(mainPane)
      .getAllByRole("link")
      .filter((link) => (link.getAttribute("href") ?? "").startsWith("/documentation/"));
    expect(internalDocLinks.length).toBeGreaterThan(0);

    await user.click(internalDocLinks[0]);
    // The link target is another documentation section that renders real
    // content under its heading hierarchy (h1 + subsections).
    expect((await screen.findAllByRole("heading")).length).toBeGreaterThan(0);
    expect(window.location.pathname).toMatch(/^\/documentation\//);
  });
});
