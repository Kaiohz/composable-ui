import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import McpRegistryPage from "@/application/pages/McpRegistryPage";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import type { RegisteredMcpServer } from "@/domain/entities/mcpServer/registeredMcpServer";
import { mcpApiClient } from "@/infrastructure/api/mcpAxiosInstance";
import { renderWithProviders } from "../../utils/render";

/**
 * REQ-016 (feat-mcp-oauth2-dual-auth) — the edit dialog must NEVER call the
 * `/reveal` endpoint automatically. The dialog is opened straight from the
 * MASKED list projection, secret inputs show the masked placeholder
 * ("stored — leave empty to keep"), and saving submits the untouched secrets
 * as unspecified (partial update preserves them, REQ-019).
 *
 * Full real chain: real page → real hooks → real api adapter; the only mock
 * is the axios adapter (HTTP boundary), mirroring
 * tests/behavioral/mcpServer/McpRegistryPage.test.tsx.
 */

const MASKED_SERVER: RegisteredMcpServer = {
  name: "weather",
  transport: McpTransportType.HTTP,
  url: "https://example.com/mcp",
  headers: {},
  env: {},
  auth_token: null,
  tool_count: 5,
  created_at: "2026-04-06T10:00:00Z",
  updated_at: "2026-04-06T10:00:00Z",
  source_type: "external",
  openapi_url: null,
  auth_mode: "headers",
};

/** What a reveal() call would return — the edit dialog must never request it. */
const REVEALED_SERVER: RegisteredMcpServer = {
  ...MASKED_SERVER,
  headers: { "X-API-Key": "cpk_live_supersecret_plaintext" },
  auth_token: "cpk_plaintext_token",
};

interface RecordedRequest {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

const originalMcpAdapter = mcpApiClient.defaults.adapter;
let requests: RecordedRequest[] = [];
let listResponse: RegisteredMcpServer[] = [MASKED_SERVER];

function stubAppConfig() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        apiBaseUrl: "http://api.test.com",
        wsBaseUrl: "ws://api.test.com",
        ragApiBaseUrl: "https://ragany.test.com",
        mcpApiBaseUrl: "",
        oauth2ProxyUrl: "",
        logtoUrl: "",
        logtoAppId: "",
        builtInMcpServers: [],
      }),
    }),
  );
}

function installMcpAdapter() {
  mcpApiClient.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? "get").toLowerCase();
    const url = config.url ?? "";
    let body: Record<string, unknown> = {};
    if (typeof config.data === "string") {
      try {
        body = JSON.parse(config.data) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
    requests.push({ method, url, body });

    const data = url.endsWith("/reveal")
      ? REVEALED_SERVER
      : url.endsWith("/validate")
        ? { tool_count: MASKED_SERVER.tool_count }
        : Array.isArray(listResponse)
          ? listResponse
          : MASKED_SERVER;

    return {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  });
}

const findReveal = () => requests.find((r) => /\/reveal$/.test(r.url));
const findValidate = () =>
  requests.find((r) => r.method === "post" && r.url.endsWith("/validate"));
const findUpdate = () =>
  requests.find(
    (r) => r.method === "put" && r.url.startsWith("/api/v1/mcp/servers/"),
  );

/**
 * A masked read projection WITHOUT `auth_mode` (M-3 rollout skew): the
 * registry does not echo the field, so the mode is UNKNOWN.
 */
function withoutAuthMode(server: RegisteredMcpServer): RegisteredMcpServer {
  const clone = { ...server };
  delete clone.auth_mode;
  return clone;
}

/** BUG-003: accept the one-line confirm that gates a destructive mode switch. */
async function confirmAuthModeSwitch(user: ReturnType<typeof userEvent.setup>) {
  const confirmDialog = await screen.findByRole("alertdialog");
  await user.click(
    within(confirmDialog).getByRole("button", { name: /switch mode/i }),
  );
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
}

async function openEditDialog(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(await screen.findByText("Edit MCP Server")).toBeInTheDocument();
}

describe("McpRegistryPage edit dialog (REQ-016 — no auto-reveal)", () => {
  beforeEach(() => {
    requests = [];
    listResponse = [MASKED_SERVER];
    stubAppConfig();
    installMcpAdapter();
  });

  afterEach(() => {
    mcpApiClient.defaults.adapter = originalMcpAdapter;
    vi.unstubAllGlobals();
  });

  it("opens the edit dialog from the masked list WITHOUT calling reveal()", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);

    // The dialog is prefilled from the masked projection.
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("weather");

    // REGRESSION PIN (REQ-016): no automatic secret reveal on edit.
    expect(findReveal()).toBeUndefined();
  });

  it("shows the masked placeholder on secret fields (no plaintext prefill)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);

    // No revealed plaintext value must ever appear in the edit dialog.
    expect(screen.queryByDisplayValue("cpk_live_supersecret_plaintext")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("cpk_plaintext_token")).not.toBeInTheDocument();
    expect(screen.queryByText("cpk_live_supersecret_plaintext")).not.toBeInTheDocument();
    expect(screen.queryByText("cpk_plaintext_token")).not.toBeInTheDocument();

    // Secret inputs carry the masked placeholder instead.
    const headersValue = screen.getByLabelText(/headers value/i);
    expect(headersValue).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/leave empty to keep/i),
    );
  });

  it("saves an untouched edit with the secret fields omitted (partial update preserves them)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);
    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });

    const payload = findUpdate()?.body;
    expect(payload?.url).toBe("https://example.com/mcp");
    // Untouched secrets must NOT be sent at all — present-empty values would
    // clear them under the backend's exclude_unset partial merge (REQ-019).
    expect(payload && "headers" in payload).toBe(false);
    expect(payload && "env" in payload).toBe(false);
    expect(payload && "auth_token" in payload).toBe(false);
    // The masked list carries auth_mode; saving must forward it unchanged.
    expect(payload?.auth_mode).toBe("headers");
  });

  it("edits a user_token server with no secret fields and keeps auth_mode=user_token", async () => {
    listResponse = [{ ...MASKED_SERVER, auth_mode: "user_token" }];
    installMcpAdapter();
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);

    // user_token mode exposes NO secret fields — the backend forwards the
    // connected user's credential automatically (REQ-006).
    expect(screen.queryByText(/^headers$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /authentication/i })).toHaveTextContent(
      /oauth2/i,
    );

    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });
    expect(findUpdate()?.body.auth_mode).toBe("user_token");
    expect(findReveal()).toBeUndefined();
  });

  it("clears the stored headers when the edit switches the mode to OAuth2 (M-2: explicit empty dict)", async () => {
    listResponse = [MASKED_SERVER];
    installMcpAdapter();
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);
    await user.click(screen.getByRole("combobox", { name: /authentication/i }));
    await user.click(await screen.findByRole("option", { name: /oauth2/i }));
    // BUG-003: the destructive switch is gated by the one-line confirm.
    await confirmAuthModeSwitch(user);
    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });

    // An explicit empty mapping REPLACES the stored dict under the registry's
    // exclude_unset merge — the stale static credential stops being sent
    // alongside the injected Bearer token.
    expect(findUpdate()?.body.headers).toEqual({});
    expect(findUpdate()?.body.auth_mode).toBe("user_token");
    expect(findReveal()).toBeUndefined();
  });

  it("carries server_id and OMITS untouched masked secrets on the edit-mode Test connection (BUG-001)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);
    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(findValidate()).toBeDefined();
    });

    const payload = findValidate()?.body;
    // The edit target's identity: the registry merges the STORED secrets into
    // the candidate before probing (BUG-001 — the masked projection withholds
    // the stored credential, so the dry run MUST carry the identity it merges
    // from; the old identity-less probe ran unauthenticated and reported a
    // false "unreachable" 401).
    expect(payload?.server_id).toBe("weather");
    expect(payload?.auth_mode).toBe("headers");
    expect(payload?.url).toBe("https://example.com/mcp");
    // Untouched masked fields are sent as-is-OMITTED: a present-empty headers
    // dict would override the merged stored secrets and re-introduce the
    // false 401 (partial merge semantics, REQ-016/REQ-019).
    expect(payload && "headers" in payload).toBe(false);
    expect(payload && "env" in payload).toBe(false);
  });

  it("carries user-typed headers on the edit-mode Test connection (they replace the merged stored values)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);
    await user.type(screen.getByLabelText(/headers key/i), "X-API-Key");
    await user.type(screen.getByLabelText(/headers value/i), "cpk_typed_key");
    // Scope to the Headers editor — the env editor renders its own Add.
    const headersEditor = screen.getByText(/^headers$/i).closest("div") as HTMLElement;
    await user.click(within(headersEditor).getByRole("button", { name: /add/i }));

    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(findValidate()).toBeDefined();
    });

    const payload = findValidate()?.body;
    expect(payload?.server_id).toBe("weather");
    // A user-visible CHANGE travels (the backend replaces its merged stored
    // header with this explicit one); the untouched env editor stays omitted.
    expect(payload?.headers).toEqual({ "X-API-Key": "cpk_typed_key" });
    expect(payload && "env" in payload).toBe(false);
  });

  it("omits server_id on the create-mode Test connection (create flow unchanged)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await user.click(screen.getByRole("button", { name: /add mcp server/i }));
    expect(await screen.findByText("Create MCP Server")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/name/i), "new-server");
    await user.type(screen.getByLabelText(/url/i), "https://new.example.com/mcp");

    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(findValidate()).toBeDefined();
    });

    const payload = findValidate()?.body;
    // Create mode is a stateless dry run of a fresh candidate — no stored
    // entry exists to merge from.
    expect(payload && "server_id" in payload).toBe(false);
    expect(payload?.name).toBe("new-server");
    expect(payload?.auth_mode).toBe("headers");
  });

  it("asks for a one-line confirmation before switching an existing server's auth mode (BUG-003)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);

    await user.click(screen.getByRole("combobox", { name: /authentication/i }));
    await user.click(await screen.findByRole("option", { name: /oauth2/i }));

    // The switch is NOT applied until the destructive-transition confirm (the
    // modal confirm aria-hides the page behind it — the un-applied select is
    // only verifiable after it closes).
    const confirmDialog = await screen.findByRole("alertdialog");
    expect(within(confirmDialog).getByText(/clears the stored/i)).toBeInTheDocument();
    expect(findUpdate()).toBeUndefined();

    await confirmAuthModeSwitch(user);

    expect(screen.getByRole("combobox", { name: /authentication/i })).toHaveTextContent(/oauth2/i);

    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));
    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });
    expect(findUpdate()?.body.auth_mode).toBe("user_token");
    expect(findUpdate()?.body.headers).toEqual({});
  });

  it("keeps the current auth mode when the switch confirmation is cancelled (BUG-003)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);

    await user.click(screen.getByRole("combobox", { name: /authentication/i }));
    await user.click(await screen.findByRole("option", { name: /oauth2/i }));

    const confirmDialog = await screen.findByRole("alertdialog");
    await user.click(
      within(confirmDialog).getByRole("button", { name: /cancel/i }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // The select kept the stored mode and saving leaves the stored credential
    // untouched (headers omitted — no wipe).
    expect(screen.getByRole("combobox", { name: /authentication/i })).toHaveTextContent(/api key/i);
    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));
    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });
    expect(findUpdate()?.body.auth_mode).toBe("headers");
    expect(findUpdate() && "headers" in (findUpdate()?.body ?? {})).toBe(false);
  });

  it("does NOT ask for confirmation when switching an UNKNOWN-mode server to the API key mode (nothing stored is wiped)", async () => {
    listResponse = [withoutAuthMode(MASKED_SERVER)];
    installMcpAdapter();
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);

    await user.click(screen.getByRole("combobox", { name: /authentication/i }));
    await user.click(await screen.findByRole("option", { name: /api key/i }));

    // M-3: the stored state is unknown and untouched — the transition is safe,
    // no destructive-transition confirm may appear.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /authentication/i })).toHaveTextContent(/api key/i);

    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));
    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });
    expect(findUpdate()?.body.auth_mode).toBe("headers");
    expect(findUpdate() && "headers" in (findUpdate()?.body ?? {})).toBe(false);
  });

  it("keeps the list view masked after the dialog save cycle", async () => {
    const user = userEvent.setup();

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("weather");
    await openEditDialog(user);
    await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

    await waitFor(() => {
      expect(findUpdate()).toBeDefined();
    });

    // The registry list stays masked (REQ-018): no plaintext secret text in
    // the whole document.
    expect(screen.queryByText("cpk_live_supersecret_plaintext")).not.toBeInTheDocument();
    expect(screen.queryByText("cpk_plaintext_token")).not.toBeInTheDocument();
    const grid = document.querySelector('[data-od-id="mcp-server-grid"]');
    if (grid) {
      expect(within(grid as HTMLElement).queryByText(/supersecret|plaintext/i)).toBeNull();
    }
  });
});
