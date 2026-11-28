/**
 * Spec: scope-rag-memories-user-agent.md — REQ-022 (+ REQ-026 same-component
 * contract on the Memories page), under the user × agent directive.
 *
 * Behavioral entry point: the REAL MemoriesPage rendered with RTL and the real
 * provider chain; every internal layer runs real — useSpaces, useStoreFiles,
 * useStoreFilePreviews, useCreateMemory, the Create dialog, the MemoryGrid and
 * the Viewer against the real store api; only the network boundary
 * (`GET/PUT/DELETE /api/v1/store/files…`, `GET /api/v1/spaces`) is scripted
 * (repo-convention axios adapters; MSW is not installed in this repo).
 *
 * Contract under test (REQ-022 + user × agent directive):
 * - its own space selector (same source `GET /api/v1/spaces`, same header-bar
 *   placement as the RAG page, `data-od-id="space-selector"`);
 * - NO Personal entry anywhere: the page DEFAULTS to the first option of the
 *   ordered list — the builtin-first catalog agent (`composable-ai-assistant`)
 *   — whose grid lists the `/memories/composable-ai-assistant/` namespace;
 * - selecting agent-zeta → `useStoreFiles`/previews operate on
 *   `/memories/agent-zeta/` (grid lists `/memories/agent-zeta/*.md` only —
 *   the store's startswith filter leaks NESTED rows, which `isDirectMemoryChild`
 *   must exclude, REQ-012);
 * - the Create dialog DISPLAYS the target space and creates inside it
 *   (`/memories/{agent}/…`);
 * - the Viewer and delete operate within the selected space
 *   (`GET/DELETE /api/v1/store/files//memories/agent-zeta/<name>.md`).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import MemoriesPage from "@/application/pages/MemoriesPage";
import { renderWithProviders } from "../../utils/render";
import {
  decodedStoreFilePath,
  restoreAllNetworks,
  stubNetwork,
  type CapturedRequest,
  type StubbedNetwork,
} from "../../utils/network";
import { MEMORIES_BY_PREFIX, spacesRoutes, storeRoutes } from "../../fixtures/spaces";

function stubMemoriesNetwork(): StubbedNetwork {
  return stubNetwork([...storeRoutes(MEMORIES_BY_PREFIX), ...spacesRoutes()]);
}

function getSpaceTrigger(): HTMLElement {
  return screen.getByRole("combobox", { name: /space/i });
}

async function selectSpace(label: RegExp): Promise<void> {
  const user = userEvent.setup();
  await user.click(getSpaceTrigger());
  await user.click(await screen.findByRole("option", { name: label }, {}, { timeout: 2000 }));
}

function findByText(text: string) {
  return screen.findByText(text, {}, { timeout: 2000 });
}

function latest(net: StubbedNetwork, method: string, match: RegExp): CapturedRequest {
  const found = net.requests.filter((req) => req.method === method && match.test(req.path));
  expect(found.length, `expected a captured ${method} ${match} request`).toBeGreaterThan(0);
  return found[found.length - 1];
}

function lastListingRequestsBy(net: StubbedNetwork, prefix: string) {
  const listings = net.requests.filter(
    (req) => /\/api\/v1\/store\/files$/.test(req.path) && req.query.prefix === prefix,
  );
  const previews = net.requests.filter(
    (req) => /\/api\/v1\/store\/files\/previews$/.test(req.path) && req.query.prefix === prefix,
  );
  return { listings, previews };
}

afterEach(() => {
  restoreAllNetworks();
});

describe("MemoriesPage space selector header bar (REQ-022)", () => {
  it("displays its space selector as a header bar above the memory grid", async () => {
    stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });

    await findByText("assistant-prefs.md");

    const bar = document.querySelector<HTMLElement>('[data-od-id="space-selector"]');
    expect(bar, "Memories page must render the shared space selector").not.toBeNull();
    const grid = document.querySelector<HTMLElement>('[data-od-id="memory-grid"]');
    expect(grid).not.toBeNull();
    expect(bar!.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("defaults to the FIRST agent space (composable-ai-assistant): listings operate on /memories/composable-ai-assistant/ — Personal is never an option", async () => {
    const net = stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });

    await findByText("assistant-prefs.md");
    expect(getSpaceTrigger()).toHaveTextContent("composable-ai-assistant");

    const { listings, previews } = lastListingRequestsBy(
      net,
      "/memories/composable-ai-assistant/",
    );
    expect(
      listings.length,
      "useStoreFiles must list the default agent's namespace",
    ).toBeGreaterThan(0);
    expect(previews.length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(getSpaceTrigger());
    expect(await screen.findByRole("option", { name: /composable-ai-assistant/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /personal/i })).toBeNull();
  });

  it("excludes nested rows from the agent grid (store startswith leak → direct children only, REQ-012)", async () => {
    stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");

    await selectSpace(/agent-zeta/i);

    // The agent-zeta listing returns the nested /memories/agent-zeta/archive/
    // old-note.md row too (startswith filter): the grid must keep only its
    // OWN namespace's direct children.
    expect(await findByText("zeta-notes.md")).toBeInTheDocument();
    expect(screen.queryByText("old-note.md")).toBeNull();
    // Exactly ONE direct child (zeta-notes.md), matching the count badge.
    expect(screen.getAllByRole("button", { name: /configure/i })).toHaveLength(1);
    expect(screen.getByText("1 memory")).toBeInTheDocument();
  });

  it("targets the scope-relative path when another scope shares the basename (no wrong-target reconstruction)", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-notes.md");

    // zeta-notes.md exists in the flat /memories/ fixture namespace too: opening
    // the agent-zeta card must fetch the FULL scoped path, never the flat one.
    await user.click(document.querySelector('[data-od-id="memory-configure-zeta-notes.md"]')!);

    await waitFor(
      () => {
        const getRequest = latest(net, "GET", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(getRequest.path)).toBe("/memories/agent-zeta/zeta-notes.md");
      },
      { timeout: 2000 },
    );

    // …and deleting it must never cascade to another scope's basename twin.
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled(), {
      timeout: 2000,
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /confirm delete\?/i }));
    const deleteRequest = latest(net, "DELETE", /\/api\/v1\/store\/files\/./);
    expect(decodedStoreFilePath(deleteRequest.path)).toBe("/memories/agent-zeta/zeta-notes.md");
  });

  it("opens the Viewer and deletes a default-space memory at the exact scoped path", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");

    await user.click(document.querySelector('[data-od-id="memory-configure-assistant-prefs.md"]')!);

    await waitFor(
      () => {
        const getRequest = latest(net, "GET", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(getRequest.path)).toBe(
          "/memories/composable-ai-assistant/assistant-prefs.md",
        );
      },
      { timeout: 2000 },
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled(), {
      timeout: 2000,
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /confirm delete\?/i }));
    const deleteRequest = latest(net, "DELETE", /\/api\/v1\/store\/files\/./);
    expect(decodedStoreFilePath(deleteRequest.path)).toBe(
      "/memories/composable-ai-assistant/assistant-prefs.md",
    );
  });

  it("selecting agent-zeta drives useStoreFiles (and previews) to /memories/agent-zeta/ and lists only the agent's memories", async () => {
    const net = stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");

    await selectSpace(/agent-zeta/i);

    expect(await findByText("zeta-notes.md")).toBeInTheDocument();
    const { listings, previews } = lastListingRequestsBy(net, "/memories/agent-zeta/");
    expect(listings.length, "useStoreFiles path must become /memories/agent-zeta/").toBeGreaterThan(
      0,
    );
    expect(previews.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("assistant-prefs.md")).toBeNull());
  });

  it("Create dialog displays the target space and creates the memory inside it", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-notes.md");

    await user.click(screen.getByRole("button", { name: /create memory/i }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 2000 });
    expect(
      within(dialog).getAllByText(/agent-zeta/).length,
      "the Create dialog must display the target space",
    ).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Name"), "fresh-note");
    await user.click(within(dialog).getByRole("button", { name: "Create Memory" }));

    await waitFor(
      () => {
        const putRequest = latest(net, "PUT", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(putRequest.path)).toBe("/memories/agent-zeta/fresh-note.md");
      },
      { timeout: 2000 },
    );
  });

  it("creating with the default agent selected stores under the agent namespace", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");
    expect(getSpaceTrigger()).toHaveTextContent("composable-ai-assistant");

    await user.click(screen.getByRole("button", { name: /create memory/i }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 2000 });
    await user.type(screen.getByLabelText("Name"), "fresh-assistant");
    await user.click(within(dialog).getByRole("button", { name: "Create Memory" }));

    await waitFor(
      () => {
        const putRequest = latest(net, "PUT", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(putRequest.path)).toBe(
          "/memories/composable-ai-assistant/fresh-assistant.md",
        );
      },
      { timeout: 2000 },
    );
  });

  it("opens the Viewer, edits and deletes within the selected space", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("assistant-prefs.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-notes.md");

    await user.click(screen.getByRole("button", { name: /configure/i }));

    // The viewer reads the FULL scoped store path.
    await waitFor(
      () => {
        const getRequest = latest(net, "GET", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(getRequest.path)).toBe("/memories/agent-zeta/zeta-notes.md");
      },
      { timeout: 2000 },
    );

    // Edit → save → the write stays scoped to the selected space.
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled(), {
      timeout: 2000,
    });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(
      () => expect(screen.getByRole("textbox", { name: /content/i })).toBeInTheDocument(),
      {
        timeout: 2000,
      },
    );
    await user.type(screen.getByRole("textbox", { name: /content/i }), " # updated");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    const putRequest = latest(net, "PUT", /\/api\/v1\/store\/files\/./);
    expect(decodedStoreFilePath(putRequest.path)).toBe("/memories/agent-zeta/zeta-notes.md");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /confirm delete\?/i }));
    const deleteRequest = latest(net, "DELETE", /\/api\/v1\/store\/files\/./);
    expect(decodedStoreFilePath(deleteRequest.path)).toBe("/memories/agent-zeta/zeta-notes.md");
  });
});
