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

type AuthMode = "headers" | "user_token";

/** Expected next contract (REQ-004): the masked projection carries auth_mode. */
type RegisteredMcpServerWithAuthMode = RegisteredMcpServer & { auth_mode: AuthMode };

const MASKED_SERVER: RegisteredMcpServerWithAuthMode = {
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
const findUpdate = () =>
  requests.find(
    (r) => r.method === "put" && r.url.startsWith("/api/v1/mcp/servers/"),
  );

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
