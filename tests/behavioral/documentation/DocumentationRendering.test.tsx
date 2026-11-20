/**
 * Spec: add-user-documentation.md — rendering robustness (BUG-006).
 *
 * The documentation renderer derives React keys from authored content plus a
 * per-list occurrence suffix (`withStableKeys`, Sonar S6479 — no array-index
 * keys). Repeated separators and label chips inside one paragraph or step
 * must stay unique, so every chapter must render without React's
 * "Encountered two children with the same key" duplicate-key error.
 *
 * React only reports duplicate keys in development mode — the production
 * build strips the warning — so this guard belongs in the implementation
 * suite next to the renderer, not in the e2e suite.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppRoot from "@/application/App";
import { DOC_CHAPTERS } from "../../../src/application/pages/documentation/content";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderAppAt(path: string): void {
  window.history.replaceState({}, "", path);
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe("Documentation rendering — no duplicate React keys (BUG-006)", () => {
  const duplicateKeyPattern = /same key|duplicate key|children may be duplicated/i;
  let consoleErrors: string[] = [];
  let errorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    consoleErrors = [];
    const originalConsoleError = console.error.bind(console);
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0]);
      consoleErrors.push(message);
      // Suppress only the expected duplicate-key signal; re-raise every other
      // console error so this guard cannot hide unrelated React problems.
      if (!duplicateKeyPattern.test(message)) originalConsoleError(...args);
    });
    window.history.replaceState({}, "", "/documentation");
  });

  afterEach(() => {
    errorSpy?.mockRestore();
    window.history.replaceState({}, "", "/documentation");
  });

  it.each(DOC_CHAPTERS.map((chapter) => [chapter.doc, chapter] as const))(
    "%s renders its full content without React duplicate-key errors",
    async (_doc, chapter) => {
      renderAppAt(`/documentation/${chapter.slug}`);

      // Act — render the complete chapter (h1 + h2 subsections, all blocks).
      const headings = await screen.findAllByRole("heading");
      expect(headings.length).toBeGreaterThan(0);

      // Assert — React emitted no duplicate-key error while rendering.
      const duplicateKeyErrors = consoleErrors.filter((message) =>
        duplicateKeyPattern.test(message),
      );
      expect(duplicateKeyErrors, `${chapter.doc} must render without duplicate React keys`).toEqual(
        [],
      );
    },
  );
});
