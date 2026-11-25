import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { renderWithProviders } from "../../../utils/render";
import { CreateMcpServerDialog } from "@/application/components/mcpServer/CreateMcpServerDialog";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import type {
  RegisteredMcpServer,
} from "@/domain/entities/mcpServer/registeredMcpServer";
import { mcpApiClient } from "@/infrastructure/api/mcpAxiosInstance";

/**
 * Behavioral tests for the MCP server create/edit dialog.
 *
 * REQ-006 (feat-mcp-oauth2-dual-auth): the legacy "Auth Token" input is
 * replaced by a single "Authentication" select with EXACTLY two modes:
 *   - "OAuth2 — connected user's token" → `auth_mode: "user_token"`, no
 *     secret fields displayed (headers section hidden);
 *   - "API key — headers" (default) → `auth_mode: "headers"`, the existing
 *     Headers KeyValueEditor is shown.
 * "Test connection" validates the chosen mode end-to-end (the payload
 * carries `auth_mode`).
 *
 * REQ-016: the edit dialog never reveals secrets automatically; secret
 * inputs show the masked placeholder ("stored — leave empty to keep") and
 * submit as unspecified (secret keys omitted — the backend partial-update
 * merge preserves them).
 *
 * The full real chain runs (dialog → hooks → api adapter): the only mock is
 * the axios adapter (HTTP boundary), mirroring the behavioral page test
 * pattern in tests/behavioral/mcpServer/McpRegistryPage.test.tsx. No
 * internal component, hook, store or domain function is mocked.
 */

/**
 * A masked read projection WITHOUT `auth_mode` (M-3): the registry does not
 * echo the field yet, so an entry legitimately carries no mode. The dialog
 * must treat this as UNKNOWN — show a placeholder and never re-send a
 * guessed mode (it would silently downgrade a user_token server).
 */
function withoutAuthMode(server: RegisteredMcpServer): RegisteredMcpServer {
  const clone = { ...server };
  delete clone.auth_mode;
  return clone;
}

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

interface RecordedRequest {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

const originalMcpAdapter = mcpApiClient.defaults.adapter;
let requests: RecordedRequest[] = [];

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

function installMcpAdapter(options: { validateStatus?: number; validateDetail?: string } = {}) {
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

    const isValidate = url.endsWith("/validate");
    if (isValidate && options.validateStatus && options.validateStatus >= 400) {
      const error = new Error("Request failed with status") as Error & {
        response?: {
          status: number;
          data: unknown;
          headers: Record<string, string>;
          config: InternalAxiosRequestConfig;
        };
      };
      error.response = {
        status: options.validateStatus,
        data: { detail: options.validateDetail ?? "Server unreachable" },
        headers: {},
        config,
      };
      throw error;
    }

    return {
      data: isValidate ? { tool_count: 7 } : MASKED_SERVER,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  });
}

const findCreate = () =>
  requests.find((r) => r.method === "post" && r.url.endsWith("/api/v1/mcp/servers"));
const findValidate = () =>
  requests.find((r) => r.method === "post" && r.url.endsWith("/validate"));
const findUpdate = () =>
  requests.find(
    (r) => r.method === "put" && r.url.startsWith("/api/v1/mcp/servers/"),
  );
function getAuthSelect() {
  return screen.getByRole("combobox", { name: /authentication/i });
}

async function selectAuthMode(user: ReturnType<typeof userEvent.setup>, mode: "oauth" | "api-key") {
  await user.click(getAuthSelect());
  const optionName = mode === "oauth" ? /oauth2/i : /api key/i;
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("CreateMcpServerDialog", () => {
  beforeEach(() => {
    requests = [];
    stubAppConfig();
    installMcpAdapter();
  });

  afterEach(() => {
    mcpApiClient.defaults.adapter = originalMcpAdapter;
    vi.unstubAllGlobals();
  });

  describe("dialog shell", () => {
    it("renders the dialog container with data-od-id when open", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      const dialog = document.querySelector('[data-od-id="create-mcp-server-dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog).toBeInTheDocument();
    });

    it("renders the name input", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it("renders the url input", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
    });

    it("renders a Headers key/value editor (API key mode is the default)", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/^headers$/i)).toBeInTheDocument();
    });

    it("renders an env key/value editor", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/^env$/i)).toBeInTheDocument();
    });

    it("renders the Test connection button", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByRole("button", { name: /test connection/i })).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByRole("button", { name: /create|save|submit/i })).toBeInTheDocument();
    });

    it("calls onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("create & validate flows", () => {
    it("submits the form values to the registry create endpoint on submit", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");
      await user.click(screen.getByRole("button", { name: /create|save|submit/i }));

      await waitFor(() => {
        expect(findCreate()).toBeDefined();
      });

      const payload = findCreate()?.body;
      expect(payload?.name).toBe("weather");
      expect(payload?.url).toBe("https://example.com/mcp");
      expect(payload?.source_type).toBe("external");
      expect(payload?.openapi_url).toBeNull();
      // REQ-006: the legacy auth_token field is removed — the payload must
      // not carry it at all.
      expect(payload && "auth_token" in payload).toBe(false);
    });

    it("shows a success message with the tool count after a successful Test connection", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");

      await user.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(findValidate()).toBeDefined();
      });
      expect(findValidate()?.body.name).toBe("weather");
      expect(findValidate()?.body.url).toBe("https://example.com/mcp");
      await waitFor(() => {
        expect(screen.getByText(/7 tools/i)).toBeInTheDocument();
      });
    });

    it("shows an error message after a failed Test connection", async () => {
      installMcpAdapter({ validateStatus: 400, validateDetail: "Server unreachable" });
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");

      await user.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(findValidate()).toBeDefined();
      });
      await waitFor(() => {
        expect(screen.getByText(/unreachable|error/i)).toBeInTheDocument();
      });
    });
  });

  describe("source type selection", () => {
    it("renders a Type select with data-od-id=mcp-source-type", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      const typeSelect = document.querySelector('[data-od-id="mcp-source-type"]');
      expect(typeSelect).not.toBeNull();
      expect(typeSelect).toBeInTheDocument();
    });

    it("offers External and OpenAPI options in the Type select", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.click(screen.getByRole("combobox", { name: /type/i }));

      await waitFor(() => {
        expect(screen.getByRole("option", { name: /external/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("option", { name: /openapi/i })).toBeInTheDocument();
    });

    it("defaults to External and shows url, headers and env fields", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
      expect(screen.getByText(/^headers$/i)).toBeInTheDocument();
      expect(screen.getByText(/^env$/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/openapi url|openapi_url/i)).not.toBeInTheDocument();
    });

    it("shows openapi_url, keeps the Headers editor and hides env when OpenAPI is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.click(screen.getByRole("combobox", { name: /type/i }));
      await user.click(screen.getByRole("option", { name: /openapi/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/openapi url|openapi_url/i)).toBeInTheDocument();
      });
      // OpenAPI servers still support explicit headers; env (and the legacy
      // auth token) are external-server-only.
      expect(screen.getByText(/^headers$/i)).toBeInTheDocument();
      expect(screen.queryByText(/^env$/i)).not.toBeInTheDocument();
    });

    it("shows url + headers + env again when switching back to External", async () => {      const user = userEvent.setup();
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.click(screen.getByRole("combobox", { name: /type/i }));
      await user.click(screen.getByRole("option", { name: /openapi/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/openapi url|openapi_url/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("combobox", { name: /type/i }));
      await user.click(screen.getByRole("option", { name: /external/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/^headers$/i)).toBeInTheDocument();
      expect(screen.getByText(/^env$/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/openapi url|openapi_url/i)).not.toBeInTheDocument();
    });

    it("calls validate with source_type openapi and openapi_url on Test connection (OpenAPI mode)", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "petstore");
      await user.click(screen.getByRole("combobox", { name: /type/i }));
      await user.click(screen.getByRole("option", { name: /openapi/i }));
      await user.type(
        screen.getByLabelText(/openapi url|openapi_url/i),
        "https://example.com/openapi.json",
      );

      await user.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(findValidate()).toBeDefined();
      });

      const payload = findValidate()?.body;
      expect(payload?.source_type).toBe("openapi");
      expect(payload?.openapi_url).toBe("https://example.com/openapi.json");
      expect(payload?.name).toBe("petstore");
      expect(payload?.url).toBeNull();
      expect(payload && "auth_token" in payload).toBe(false);
    });

    it("calls create with source_type openapi and openapi_url on submit (OpenAPI mode)", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "petstore");
      await user.click(screen.getByRole("combobox", { name: /type/i }));
      await user.click(screen.getByRole("option", { name: /openapi/i }));
      await user.type(
        screen.getByLabelText(/openapi url|openapi_url/i),
        "https://example.com/openapi.json",
      );

      await user.click(screen.getByRole("button", { name: /create|save|submit/i }));

      await waitFor(() => {
        expect(findCreate()).toBeDefined();
      });

      const payload = findCreate()?.body;
      expect(payload?.source_type).toBe("openapi");
      expect(payload?.openapi_url).toBe("https://example.com/openapi.json");
      expect(payload?.name).toBe("petstore");
      expect(payload?.url).toBeNull();
      expect(payload && "auth_token" in payload).toBe(false);
    });
  });

  describe("authentication mode selection (REQ-006)", () => {
    it("renders an Authentication select with data-od-id=mcp-auth-mode", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      const authSelect = document.querySelector('[data-od-id="mcp-auth-mode"]');
      expect(authSelect).not.toBeNull();
      expect(getAuthSelect()).toBeInTheDocument();
    });

    it("offers EXACTLY two authentication modes: OAuth2 (user token) and API key (headers)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.click(getAuthSelect());

      expect(await screen.findByRole("option", { name: /oauth2/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /api key/i })).toBeInTheDocument();
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    it("defaults to the API key (headers) mode", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(getAuthSelect()).toHaveTextContent(/api key/i);
    });

    it("does not render the legacy Auth Token input", () => {
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByLabelText(/auth token/i)).not.toBeInTheDocument();
    });

    it("hides the Headers editor when the OAuth2 mode is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await selectAuthMode(user, "oauth");

      expect(screen.queryByText(/^headers$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/headers value/i)).not.toBeInTheDocument();
    });

    it("shows the Headers editor again when switching back to the API key mode", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await selectAuthMode(user, "oauth");
      expect(screen.queryByText(/^headers$/i)).not.toBeInTheDocument();

      await selectAuthMode(user, "api-key");
      expect(screen.getByText(/^headers$/i)).toBeInTheDocument();
    });

    it("submits auth_mode=headers on create (API key mode is the default)", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");
      await user.click(screen.getByRole("button", { name: /create|save|submit/i }));

      await waitFor(() => {
        expect(findCreate()).toBeDefined();
      });

      expect(findCreate()?.body.auth_mode).toBe("headers");
    });

    it("submits auth_mode=user_token without credentials on create (OAuth2 mode)", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");
      await selectAuthMode(user, "oauth");
      await user.click(screen.getByRole("button", { name: /create|save|submit/i }));

      await waitFor(() => {
        expect(findCreate()).toBeDefined();
      });

      const payload = findCreate()?.body;
      expect(payload?.auth_mode).toBe("user_token");
      expect(Object.keys(payload?.headers ?? {})).toHaveLength(0);
      expect(payload?.auth_token == null).toBe(true);
      expect(payload && "auth_token" in payload).toBe(false);
    });

    it("validates the selected mode end-to-end: the Test connection payload carries auth_mode=user_token", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");
      await selectAuthMode(user, "oauth");

      await user.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(findValidate()).toBeDefined();
      });

      expect(findValidate()?.body.auth_mode).toBe("user_token");
      expect(Object.keys(findValidate()?.body.headers ?? {})).toHaveLength(0);
    });

    it("validates the selected mode end-to-end: the Test connection payload carries auth_mode=headers by default", async () => {
      const user = userEvent.setup();

      renderWithProviders(<CreateMcpServerDialog open={true} onOpenChange={vi.fn()} />);

      await user.type(screen.getByLabelText(/name/i), "weather");
      await user.type(screen.getByLabelText(/url/i), "https://example.com/mcp");

      await user.click(screen.getByRole("button", { name: /test connection/i }));

      await waitFor(() => {
        expect(findValidate()).toBeDefined();
      });

      expect(findValidate()?.body.auth_mode).toBe("headers");
    });

    describe("editing an existing server", () => {
      it("selects the OAuth2 mode and hides secret fields for a user_token server", () => {
        const userTokenServer = {
          ...MASKED_SERVER,
          auth_mode: "user_token",
        } as const;

        renderWithProviders(
          <CreateMcpServerDialog
            open={true}
            onOpenChange={vi.fn()}
            editServer={userTokenServer}
          />,
        );

        expect(getAuthSelect()).toHaveTextContent(/oauth2/i);
        expect(screen.queryByText(/^headers$/i)).not.toBeInTheDocument();
      });

      it("selects the API key mode for a headers server", () => {
        renderWithProviders(
          <CreateMcpServerDialog
            open={true}
            onOpenChange={vi.fn()}
            editServer={MASKED_SERVER}
          />,
        );

        expect(getAuthSelect()).toHaveTextContent(/api key/i);
      });

      it("submits auth_mode=user_token when saving a user_token server", async () => {
        const user = userEvent.setup();
        const userTokenServer = {
          ...MASKED_SERVER,
          auth_mode: "user_token",
        } as const;

        renderWithProviders(
          <CreateMcpServerDialog
            open={true}
            onOpenChange={vi.fn()}
            editServer={userTokenServer}
          />,
        );

        await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

        await waitFor(() => {
          expect(findUpdate()).toBeDefined();
        });

        const payload = findUpdate()?.body;
        expect(payload?.auth_mode).toBe("user_token");
        // Unrelated save in user_token mode: the (hidden) credential editors
        // were untouched — headers/env are OMITTED so stored values that are
        // not part of the injected-credential mode are preserved, never wiped.
        expect(payload && "headers" in payload).toBe(false);
        expect(payload && "env" in payload).toBe(false);
      });

      describe("auth-mode switch semantics (M-2/M-3)", () => {
        it("clears the stored headers when an existing headers server is switched to the OAuth2 mode (M-2)", async () => {
          const user = userEvent.setup();

          renderWithProviders(
            <CreateMcpServerDialog open={true} onOpenChange={vi.fn()} editServer={MASKED_SERVER} />,
          );

          await selectAuthMode(user, "oauth");
          await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

          await waitFor(() => {
            expect(findUpdate()).toBeDefined();
          });

          // M-2: an EXPLICIT empty mapping REPLACES the stored dict under the
          // registry's exclude_unset merge — an OMITTED key would preserve the
          // stored static credential alongside the injected Bearer token.
          expect(findUpdate()?.body.headers).toEqual({});
          expect(findUpdate()?.body.auth_mode).toBe("user_token");
        });

        it("clears headers when a user_token server is switched back to API key mode without touching secrets", async () => {
          const user = userEvent.setup();

          renderWithProviders(
            <CreateMcpServerDialog
              open={true}
              onOpenChange={vi.fn()}
              editServer={{ ...MASKED_SERVER, auth_mode: "user_token", headers: {}, env: {} }}
            />,
          );

          await selectAuthMode(user, "api-key");
          await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

          await waitFor(() => {
            expect(findUpdate()).toBeDefined();
          });

          // Crossing the boundary from user_token with an untouched (masked)
          // editor: the user_token-era stored credential must not be carried
          // across — an explicit empty dict clears it.
          expect(findUpdate()?.body.headers).toEqual({});
          expect(findUpdate()?.body.auth_mode).toBe("headers");
        });

        it("clears headers when an UNKNOWN-mode server is switched to the OAuth2 mode (stored credential is moot)", async () => {
          const user = userEvent.setup();

          renderWithProviders(
            <CreateMcpServerDialog
              open={true}
              onOpenChange={vi.fn()}
              editServer={withoutAuthMode(MASKED_SERVER)}
            />,
          );

          await selectAuthMode(user, "oauth");
          await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

          await waitFor(() => {
            expect(findUpdate()).toBeDefined();
          });

          expect(findUpdate()?.body.headers).toEqual({});
          expect(findUpdate()?.body.auth_mode).toBe("user_token");
        });

        it("treats an absent auth_mode as UNKNOWN: placeholder shown, no auth_mode/headers/env on the update (M-3)", async () => {
          const user = userEvent.setup();

          renderWithProviders(
            <CreateMcpServerDialog
              open={true}
              onOpenChange={vi.fn()}
              editServer={withoutAuthMode(MASKED_SERVER)}
            />,
          );

          // The select must NOT display a guessed mode for an unknown wire.
          expect(getAuthSelect()).toHaveTextContent(/unknown/i);

          await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

          await waitFor(() => {
            expect(findUpdate()).toBeDefined();
          });

          const payload = findUpdate()?.body;
          // Without the wire echo, the stored mode AND the stored credentials
          // are unknown — an unrelated edit must touch neither (no guessed
          // auth_mode "headers", no wiped stored headers/env).
          expect("auth_mode" in payload).toBe(false);
          expect("headers" in payload).toBe(false);
          expect("env" in payload).toBe(false);
        });

        it("sends auth_mode once the user explicitly picks API key mode from UNKNOWN, without clearing untouched headers", async () => {
          const user = userEvent.setup();

          renderWithProviders(
            <CreateMcpServerDialog
              open={true}
              onOpenChange={vi.fn()}
              editServer={withoutAuthMode(MASKED_SERVER)}
            />,
          );

          await selectAuthMode(user, "api-key");
          await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

          await waitFor(() => {
            expect(findUpdate()).toBeDefined();
          });

          const payload = findUpdate()?.body;
          // Now known (explicitly picked): sent. But the unknown → headers
          // transition must NOT wipe possibly-stored headers — the credential
          // state was never visible to the user.
          expect(payload?.auth_mode).toBe("headers");
          expect(payload && "headers" in payload).toBe(false);
        });

        it("clears the stored headers after a user_token → headers → user_token round trip (M-2)", async () => {
          const user = userEvent.setup();

          renderWithProviders(
            <CreateMcpServerDialog
              open={true}
              onOpenChange={vi.fn()}
              editServer={{ ...MASKED_SERVER, auth_mode: "user_token" }}
            />,
          );

          await selectAuthMode(user, "api-key");
          await selectAuthMode(user, "oauth");
          await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

          await waitFor(() => {
            expect(findUpdate()).toBeDefined();
          });

          // The round trip ends on the mode it started with: a final-vs-
          // initial comparison would drop the clear — yet the user DID cross
          // INTO user_token during this session, so the stored static
          // credential must not survive it (an absent key would preserve it
          // under the registry's exclude_unset merge).
          expect(findUpdate()?.body.headers).toEqual({});
          expect(findUpdate()?.body.auth_mode).toBe("user_token");
        });
      });
    });
  });

  describe("edit dialog secrets (REQ-016)", () => {
    it("shows the masked placeholder on secret fields instead of plaintext", () => {
      renderWithProviders(
        <CreateMcpServerDialog
          open={true}
          onOpenChange={vi.fn()}
          editServer={MASKED_SERVER}
        />,
      );

      const headersValue = screen.getByLabelText(/headers value/i);
      expect(headersValue).toHaveAttribute("placeholder", expect.stringMatching(/leave empty to keep/i));
    });

    it("submits untouched secret fields as unspecified (keys omitted) so the partial update preserves them", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <CreateMcpServerDialog
          open={true}
          onOpenChange={vi.fn()}
          editServer={MASKED_SERVER}
        />,
      );

      await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

      await waitFor(() => {
        expect(findUpdate()).toBeDefined();
      });

      const payload = findUpdate()?.body;
      expect(payload?.url).toBe("https://example.com/mcp");
      // Partial update semantics (REQ-019): untouched secret fields must be
      // ABSENT from the payload — present-empty values would clear them.
      expect(payload && "headers" in payload).toBe(false);
      expect(payload && "env" in payload).toBe(false);
      expect(payload && "auth_token" in payload).toBe(false);
    });

    it("sends newly entered headers while omitting untouched secrets", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <CreateMcpServerDialog
          open={true}
          onOpenChange={vi.fn()}
          editServer={MASKED_SERVER}
        />,
      );

      await user.type(screen.getByLabelText(/headers key/i), "X-API-Key");
      await user.type(screen.getByLabelText(/headers value/i), "cpk_explicit_new_key");
      // Scope to the Headers editor — the env editor renders its own Add.
      const headersEditor = screen.getByText(/^headers$/i).closest("div") as HTMLElement;
      await user.click(within(headersEditor).getByRole("button", { name: /add/i }));

      await user.click(screen.getByRole("button", { name: /save|create|submit/i }));

      await waitFor(() => {
        expect(findUpdate()).toBeDefined();
      });

      const payload = findUpdate()?.body;
      expect(payload?.headers).toEqual({ "X-API-Key": "cpk_explicit_new_key" });
      expect(payload && "env" in payload).toBe(false);
      expect(payload && "auth_token" in payload).toBe(false);
    });
  });
});
