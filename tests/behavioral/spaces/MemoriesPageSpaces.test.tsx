/**
 * Spec: scope-rag-memories-user-agent.md — REQ-022 (+ REQ-026 same-component
 * contract on the Memories page).
 *
 * Behavioral entry point: the REAL MemoriesPage rendered with RTL and the real
 * provider chain; every internal layer runs real — useSpaces, useStoreFiles,
 * useStoreFilePreviews, useCreateMemory, the Create dialog, the MemoryGrid and
 * the Viewer against the real store api; only the network boundary
 * (`GET/PUT/DELETE /api/v1/store/files…`, `GET /api/v1/spaces`) is scripted
 * (repo-convention axios adapters; MSW is not installed in this repo).
 *
 * Contract under test (REQ-022):
 * - its own space selector (same source `GET /api/v1/spaces`, same header-bar
 *   placement as the RAG page, `data-od-id="space-selector"`);
 * - Personal (default) → grid lists the flat `/memories/` namespace;
 * - selecting agent-zeta → `useStoreFiles`/previews operate on
 *   `/memories/agent-zeta/` (grid lists `/memories/agent-zeta/*.md` only);
 * - the Create dialog DISPLAYS the target space and creates inside it
 *   (`/memories/{agent}/…` vs `/memories/…` for Personal);
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

    await findByText("user-prefs.md");

    const bar = document.querySelector<HTMLElement>('[data-od-id="space-selector"]');
    expect(bar, "Memories page must render the shared space selector").not.toBeNull();
    const grid = document.querySelector<HTMLElement>('[data-od-id="memory-grid"]');
    expect(grid).not.toBeNull();
    expect(bar!.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("defaults to Personal (selector shows Personal first): listings operate on the flat /memories/ namespace", async () => {
    const net = stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });

    await findByText("user-prefs.md");
    expect(getSpaceTrigger()).toHaveTextContent("Personal");

    const { listings, previews } = lastListingRequestsBy(net, "/memories/");
    expect(listings.length, "useStoreFiles must list the personal namespace").toBeGreaterThan(0);
    expect(previews.length, "previews must list the personal namespace").toBeGreaterThan(0);
  });

  it("excludes agent-scope memories from the Personal grid (store startswith parity, REQ-012)", async () => {
    stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });

    // The flat listing returns the nested agent rows too (startswith filter):
    // the grid must keep only its OWN namespace's direct children. The
    // fixture also carries a SAME-BASENAME collision (a personal
    // /memories/zeta-notes.md next to /memories/agent-zeta/zeta-notes.md), so
    // the old "basename-only" cards would render two identically-named targets.
    expect(await findByText("user-prefs.md")).toBeInTheDocument();
    // Exactly TWO direct personal children (user-prefs.md + the flat
    // zeta-notes.md); the nested agent row is filtered out (would be three).
    expect(screen.getAllByRole("button", { name: /configure/i })).toHaveLength(2);
    // Exactly ONE card named zeta-notes.md — the flat personal memory (the
    // agent row would make it two identical labels).
    expect(screen.getAllByText("zeta-notes.md")).toHaveLength(1);
    // The count badge matches the filtered grid (2 personal memories, not 3).
    expect(screen.getByText("2 memories")).toBeInTheDocument();
  });

  it("opens the Viewer and deletes a Personal memory at the exact flat path", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("user-prefs.md");

    // First card in path order = the personal user-prefs.md: under the old
    // basename reconstruction this test FAILED (the unfiltered grid's first
    // card was the agent one and its target collapsed to /memories/zeta-notes.md).
    await user.click(screen.getAllByRole("button", { name: /configure/i })[0]);

    // The viewer reads the EXACT stored flat path — the nested agent memory
    // (same basename in other spaces) can never be mistaken for the target.
    await waitFor(
      () => {
        const getRequest = latest(net, "GET", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(getRequest.path)).toBe("/memories/user-prefs.md");
      },
      { timeout: 2000 },
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled(), {
      timeout: 2000,
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /confirm delete\?/i }));
    const deleteRequest = latest(net, "DELETE", /\/api\/v1\/store\/files\/./);
    expect(decodedStoreFilePath(deleteRequest.path)).toBe("/memories/user-prefs.md");
  });

  it("targets the FLAT personal memory when a memory shares its basename with an agent scope", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("user-prefs.md");

    // Second card = the flat /memories/zeta-notes.md. Its basename exists in
    // agent-zeta's namespace too: opening it must fetch the PERSONAL file.
    await user.click(screen.getAllByRole("button", { name: /configure/i })[1]);

    await waitFor(
      () => {
        const getRequest = latest(net, "GET", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(getRequest.path)).toBe("/memories/zeta-notes.md");
      },
      { timeout: 2000 },
    );

    // …and deleting it must never cascade to the agent's memory.
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled(), {
      timeout: 2000,
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /confirm delete\?/i }));
    const deleteRequest = latest(net, "DELETE", /\/api\/v1\/store\/files\/./);
    expect(decodedStoreFilePath(deleteRequest.path)).toBe("/memories/zeta-notes.md");
  });

  it("selecting agent-zeta drives useStoreFiles (and previews) to /memories/agent-zeta/ and lists only the agent's memories", async () => {
    const net = stubMemoriesNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("user-prefs.md");

    await selectSpace(/agent-zeta/i);

    expect(await findByText("zeta-notes.md")).toBeInTheDocument();
    const { listings, previews } = lastListingRequestsBy(net, "/memories/agent-zeta/");
    expect(listings.length, "useStoreFiles path must become /memories/agent-zeta/").toBeGreaterThan(
      0,
    );
    expect(previews.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("user-prefs.md")).toBeNull());
  });

  it("Create dialog displays the target space and creates the memory inside it", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("user-prefs.md");

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

  it("creating with Personal selected keeps the flat personal namespace", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("user-prefs.md");
    expect(getSpaceTrigger()).toHaveTextContent("Personal");

    await user.click(screen.getByRole("button", { name: /create memory/i }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 2000 });
    await user.type(screen.getByLabelText("Name"), "fresh-personal");
    await user.click(within(dialog).getByRole("button", { name: "Create Memory" }));

    await waitFor(
      () => {
        const putRequest = latest(net, "PUT", /\/api\/v1\/store\/files\/./);
        expect(decodedStoreFilePath(putRequest.path)).toBe("/memories/fresh-personal.md");
      },
      { timeout: 2000 },
    );
  });

  it("opens the Viewer and deletes within the selected space", async () => {
    const net = stubMemoriesNetwork();
    const user = userEvent.setup();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await findByText("user-prefs.md");

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
