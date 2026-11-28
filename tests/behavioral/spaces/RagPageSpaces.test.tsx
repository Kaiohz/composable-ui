/**
 * Spec: scope-rag-memories-user-agent.md — REQ-021 (+ REQ-026 same-component
 * contract on the RAG page), under the user × agent directive.
 *
 * Behavioral entry point: the REAL RagPage rendered with RTL and the real
 * provider chain (React Query + router, renderWithProviders). All internal
 * components run real — real hooks (spaces, files, folders, upload, create
 * folder, delete, classical index/query, current-user) against real api
 * layers; only the network boundary is scripted (routing axios adapters, the
 * repo convention — MSW is not installed in this repo).
 *
 * Contract under test (REQ-021 + the REAL mcp-raganything wire contract):
 * mcp-raganything composes the scope SERVER-SIDE (`file_routes.py::
 * _scoped_prefix`, `classical_query_use_case.py::_compose_scoped_working_dir`)
 * from the authenticated identity plus the `X-Composable-Agent` header, so the
 * client sends RELATIVE prefixes/working_dirs and selects the space via the
 * header — never a client-built `{user_id}/{agent_slug}/` key (REQ-002):
 * - a space selector rendered as a header bar ABOVE the file explorer,
 *   exposing `data-od-id="space-selector"`;
 * - NO Personal entry anywhere (the personal namespace is a system-internal
 *   fallback): the pages DEFAULT to the first option of the ordered list
 *   — the builtin-first catalog agent (`composable-ai-assistant`);
 * - listing all the user's real spaces (`GET /api/v1/spaces`): builtin
 *   platform agents first among agents, external scopes;
 * - selection scopes file browsing (RELATIVE `prefix` args + scope header to
 *   useFiles / useFolders), folder creation, file deletion, upload and
 *   classical indexing/queries;
 * - the existing WorkspaceSelector stays the project-level selector BELOW the
 *   space on the Query tab;
 * - selection persists within the page; graceful degradation when the spaces
 *   endpoint fails (the agent catalog still defaults the browsing scope).
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import RagPage from "@/application/pages/RagPage";
import { renderWithProviders } from "../../utils/render";
import {
  formFieldValue,
  jsonBody,
  restoreAllNetworks,
  stubNetwork,
  type CapturedRequest,
  type StubbedNetwork,
} from "../../utils/network";
import {
  RAG_SCOPE_CONTENT,
  spacesRoutes,
  ragRoutes,
  SCRAMBLED_SPACES,
  SPACES_WITH_PERSONAL,
  type SpaceRecord,
} from "../../fixtures/spaces";

/** Scope-RELATIVE prefixes: the space root of ANY selected space is "". */
const ROOT_PREFIX = "";
const DEFAULT_SCOPE_HEADER = "composable-ai-assistant";
const AGENT_SCOPE_HEADER = "agent-zeta";

function stubRagNetwork(spaces: readonly SpaceRecord[] = SCRAMBLED_SPACES): StubbedNetwork {
  return stubNetwork([...ragRoutes(RAG_SCOPE_CONTENT), ...spacesRoutes(spaces)]);
}

/** Radix Select trigger of the shared space selector (the WorkspaceSelector
 * control's accessible name never matches /space/i — no role collision). */
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

function listRequests(net: StubbedNetwork): CapturedRequest[] {
  return net.requests.filter((req) => /\/api\/v1\/files\/list$/.test(req.path));
}

function latest(net: StubbedNetwork, method: string, match: RegExp): CapturedRequest {
  const found = net.requests.filter((req) => req.method === method && match.test(req.path));
  expect(found.length, `expected a captured ${method} ${match} request`).toBeGreaterThan(0);
  return found[found.length - 1];
}

const CONTENT_TIMEOUT: { timeout: number } = { timeout: 2000 };

afterEach(() => {
  restoreAllNetworks();
});

describe("RagPage space selector header bar (REQ-021)", () => {
  it("displays the shared space selector as a header bar above the file explorer", async () => {
    stubRagNetwork();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });

    await findByText("assistant-readme.md");

    const bar = document.querySelector<HTMLElement>('[data-od-id="space-selector"]');
    expect(bar, "RAG page must render the shared space selector").not.toBeNull();
    const explorer = document.querySelector<HTMLElement>('[data-od-id="file-list"]');
    expect(explorer).not.toBeNull();
    expect(bar!.compareDocumentPosition(explorer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("defaults to the FIRST agent space (builtin composable-ai-assistant) and scopes browsing to it — Personal is never an option", async () => {
    const net = stubRagNetwork();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });

    await findByText("assistant-readme.md");

    // The relative scope-root prefix "" + the default agent scope header
    // (builtin-first catalog agent) compose the
    // {user_id}/composable-ai-assistant/ namespace SERVER-SIDE
    // (REQ-001/REQ-003 + user × agent directive).
    const scopedLists = listRequests(net).filter(
      (req) =>
        req.query.prefix === ROOT_PREFIX &&
        req.headers["x-composable-agent"] === DEFAULT_SCOPE_HEADER,
    );
    expect(
      scopedLists.length,
      "the file list request must browse the scope root with the default agent scope header",
    ).toBeGreaterThan(0);
    const scopedFolders = net.requests.find(
      (req) =>
        /\/api\/v1\/files\/folders$/.test(req.path) &&
        req.query.prefix === ROOT_PREFIX &&
        req.headers["x-composable-agent"] === DEFAULT_SCOPE_HEADER,
    );
    expect(
      scopedFolders,
      "folder listing must carry the default agent scope header",
    ).toBeDefined();

    const user = userEvent.setup();
    await user.click(getSpaceTrigger());
    expect(await screen.findByRole("option", { name: /composable-ai-assistant/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /personal/i })).toBeNull();
  });

  it("selecting agent-zeta re-scopes browsing, shows the agent's content, and navigates inside the space", async () => {
    const net = stubRagNetwork();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);

    expect(await findByText("zeta-readme.md")).toBeInTheDocument();
    const lastListRequest = listRequests(net).at(-1);
    expect(lastListRequest?.query.prefix).toBe(ROOT_PREFIX);
    expect(lastListRequest?.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);

    // Folder navigation stays relative to the selected space (the project
    // workspace bar remains the second-level, in-space navigation).
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /zeta-docs/i }));
    expect(await findByText("zeta-doc.md")).toBeInTheDocument();
    const navigated = listRequests(net).at(-1);
    expect(navigated?.query.prefix).toBe("zeta-docs/");
    expect(navigated?.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
  });

  it("selecting another agent switches the browsing scope back (and Personal stays unreachable)", async () => {
    const net = stubRagNetwork();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-readme.md");

    await selectSpace(/composable-ai-assistant/i);

    expect(await findByText("assistant-readme.md")).toBeInTheDocument();
    expect(screen.queryByText("zeta-readme.md")).toBeNull();
    const lastListRequest = listRequests(net).at(-1);
    expect(lastListRequest?.query.prefix).toBe(ROOT_PREFIX);
    expect(lastListRequest?.headers["x-composable-agent"]).toBe(DEFAULT_SCOPE_HEADER);
  });

  it("keeps the selected space when switching tabs and returning to Browse", async () => {
    stubRagNetwork();
    const user = userEvent.setup();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-readme.md");

    await user.click(screen.getByRole("tab", { name: /query/i }));
    await user.click(screen.getByRole("tab", { name: /browse/i }));

    expect(
      await findByText("zeta-readme.md"),
      "the agent space selection must persist within the page",
    ).toBeInTheDocument();
    expect(screen.queryByText("assistant-readme.md")).toBeNull();
  });

  it("resets the project workingDir when the space changes (the new scope starts at its root)", async () => {
    const net = stubRagNetwork();
    const user = userEvent.setup();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-readme.md");

    await user.click(screen.getByRole("tab", { name: /query/i }));
    await user.type(screen.getByRole("combobox", { name: /workspace/i }), "p1");
    await user.type(screen.getByRole("textbox", { name: /rag query/i }), "q1");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(
      () =>
        expect(jsonBody(latest(net, "POST", /\/api\/v1\/classical\/query$/)).working_dir).toBe(
          "p1",
        ),
      { timeout: 2000 },
    );

    // Switching space drops the project of the previous one: it would
    // otherwise target {user_id}/{new_slug}/{old_project}/ server-side.
    await user.click(screen.getByRole("tab", { name: /browse/i }));
    await selectSpace(/composable-ai-assistant/i);
    await findByText("assistant-readme.md");
    await user.click(screen.getByRole("tab", { name: /query/i }));
    expect(screen.getByRole("combobox", { name: /workspace/i })).toHaveValue("");

    await user.type(screen.getByRole("textbox", { name: /rag query/i }), "q2");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(
      () =>
        expect(jsonBody(latest(net, "POST", /\/api\/v1\/classical\/query$/)).working_dir).toBe(""),
      { timeout: 2000 },
    );
  });

  it("keeps the space selector above the project-level WorkspaceSelector on the Query tab, and scopes classical queries", async () => {
    const net = stubRagNetwork();
    const user = userEvent.setup();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await user.click(screen.getByRole("tab", { name: /query/i }));

    // The project-level WorkspaceSelector remains, BELOW the space selector.
    const bar = document.querySelector<HTMLElement>('[data-od-id="space-selector"]');
    expect(bar).not.toBeNull();
    const workspace = screen.getByRole("combobox", { name: /workspace/i });
    expect(bar!.compareDocumentPosition(workspace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.type(screen.getByRole("textbox", { name: /rag query/i }), "summarize zeta docs");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(
      () => {
        const queryRequest = latest(net, "POST", /\/api\/v1\/classical\/query$/);
        // The client-relative working_dir composes {user_id}/agent-zeta/
        // SERVER-SIDE; an empty project targets the space-root namespace.
        expect(jsonBody(queryRequest).working_dir).toBe("");
        expect(queryRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );
  });

  it("scopes folder creation, file deletion and classical file indexing within the selected space", async () => {
    const net = stubRagNetwork();
    const user = userEvent.setup();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-readme.md");

    // Folder creation → scope-relative prefix ({user_id}/agent-zeta/zeta-notes/
    // composes server-side).
    await user.click(screen.getByRole("button", { name: /new folder/i }));
    await user.type(screen.getByLabelText("Folder name"), "zeta-notes");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(
      () => {
        const createRequest = latest(net, "POST", /\/api\/v1\/files\/folders$/);
        expect(jsonBody(createRequest).prefix).toBe("zeta-notes");
        expect(createRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );

    // File deletion → scope-relative object name + EXPLICIT working_dir
    // ("" is the scope-root namespace the file was indexed into — the param is
    // never dropped, so the vector cascade cannot fall back to a default).
    await user.click(screen.getByRole("button", { name: "Delete zeta-readme.md" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }, {}, { timeout: 2000 }));
    await waitFor(
      () => {
        const deleteRequest = latest(net, "DELETE", /\/api\/v1\/files$/);
        expect(deleteRequest.query.object_name).toBe("zeta-readme.md");
        expect(deleteRequest.query.working_dir).toBe("");
        expect(deleteRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );

    // Classical file indexing → scope-relative file name + empty project
    // working_dir (composes the space-root namespace server-side).
    await user.click(screen.getByRole("button", { name: "Index" }));
    await waitFor(
      () => {
        const indexRequest = latest(net, "POST", /\/api\/v1\/classical\/file\/index$/);
        expect(jsonBody(indexRequest).file_name).toBe("zeta-readme.md");
        expect(jsonBody(indexRequest).working_dir).toBe("");
        expect(indexRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );
  });

  it("keeps folder indexing and deletion functional on folder rows (scope-relative + header)", async () => {
    const net = stubRagNetwork();
    const user = userEvent.setup();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-readme.md");

    // Folder deletion → scope-relative prefix + scope header (REQ-003/delete_folder).
    await user.click(screen.getByRole("button", { name: "Delete folder" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }, {}, { timeout: 2000 }));
    await waitFor(
      () => {
        const deleteRequest = latest(net, "DELETE", /\/api\/v1\/files\/folders$/);
        expect(deleteRequest.query.prefix).toBe("zeta-docs/");
        expect(deleteRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );

    // Folder classical indexing → relative working_dir + scope header (REQ-006).
    await user.click(screen.getByRole("button", { name: "Index folder" }));
    await waitFor(
      () => {
        const indexRequest = latest(net, "POST", /\/api\/v1\/classical\/folder\/index$/);
        expect(jsonBody(indexRequest).working_dir).toBe("zeta-docs/");
        expect(indexRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );
  });

  it("scopes uploads to the selected space", async () => {
    const net = stubRagNetwork();
    const user = userEvent.setup();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await findByText("assistant-readme.md");

    await selectSpace(/agent-zeta/i);
    await findByText("zeta-readme.md");

    const input = screen.getByLabelText("Choose files") as HTMLInputElement;
    await user.upload(input, new File(["zeta"], "zeta-upload.md", { type: "text/markdown" }));

    await waitFor(
      () => {
        const uploadRequest = latest(net, "POST", /\/api\/v1\/files\/upload$/);
        expect(formFieldValue(uploadRequest, "prefix")).toBe(ROOT_PREFIX);
        expect(uploadRequest.headers["x-composable-agent"]).toBe(AGENT_SCOPE_HEADER);
      },
      { timeout: 2000 },
    );
  });

  it("degrades gracefully when GET /api/v1/spaces fails: the agent catalog still defaults the browsing scope", async () => {
    // Retarget ONLY the spaces route of the fixture set (identify it by its
    // client + path pattern — regex `.source` keeps the escaped slashes, so a
    // bare `/…/.test(source)` can never match).
    const failingSpaces = [...spacesRoutes(SPACES_WITH_PERSONAL)].map((r) =>
      r.client === "rag" && r.match.source.includes("/spaces")
        ? { ...r, respond: () => ({ status: 500, data: { detail: "spaces unavailable" } }) }
        : r,
    );
    const net = stubNetwork([...ragRoutes(RAG_SCOPE_CONTENT), ...failingSpaces]);
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });

    await findByText("assistant-readme.md");

    const scoped = listRequests(net).filter(
      (req) =>
        req.query.prefix === ROOT_PREFIX &&
        req.headers["x-composable-agent"] === DEFAULT_SCOPE_HEADER,
    );
    expect(
      scoped.length,
      "browsing must default to the builtin-first agent scope even while spaces fail",
    ).toBeGreaterThan(0);

    const bar = document.querySelector<HTMLElement>('[data-od-id="space-selector"]');
    expect(bar).not.toBeNull();
    await waitFor(
      () => expect(bar!.textContent).toMatch(/failed|unable|error|retry/i),
      CONTENT_TIMEOUT,
    );
  });
});
