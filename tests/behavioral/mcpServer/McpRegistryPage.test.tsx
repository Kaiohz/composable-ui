import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import McpRegistryPage from "@/application/pages/McpRegistryPage";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import type { RegisteredMcpServer } from "@/domain/entities/mcpServer/registeredMcpServer";
import { mcpApiClient } from "@/infrastructure/api/mcpAxiosInstance";
import { renderWithProviders } from "../../utils/render";

const registeredServer: RegisteredMcpServer = {
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
};

const originalMcpAdapter = mcpApiClient.defaults.adapter;

afterEach(() => {
  mcpApiClient.defaults.adapter = originalMcpAdapter;
  vi.unstubAllGlobals();
});

describe("McpRegistryPage registered server cards (BUG-002 auth-mode badge)", () => {
  it("renders the auth-mode badge on registered server cards — OAuth2 / API key / UNKNOWN when the echo is absent", async () => {
    const userTokenServer: RegisteredMcpServer = {
      ...registeredServer,
      name: "oauth-server",
      auth_mode: "user_token",
    };
    const headersServer: RegisteredMcpServer = {
      ...registeredServer,
      name: "api-key-server",
      auth_mode: "headers",
    };
    // M-3 rollout skew: the echo is absent — the mode is UNKNOWN, never
    // guessed (a guessed "headers" would misrepresent a user_token server).
    const unknownModeServer: RegisteredMcpServer = { ...registeredServer };

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
          // Same built-in list as the sibling test below: the config
          // repository is a module singleton cached across tests in THIS
          // file (staleTime: Infinity), so both stubs must agree regardless
          // of run order.
          builtInMcpServers: [
            {
              name: "raganything-files",
              url: "https://ragany.test.com/files/mcp",
              transport: "http",
            },
            {
              name: "raganything-classical",
              url: "https://ragany.test.com/classical/mcp",
              transport: "http",
            },
          ],
        }),
      }),
    );
    mcpApiClient.defaults.adapter = vi.fn(async (config) => ({
      data: [userTokenServer, headersServer, unknownModeServer],
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));

    renderWithProviders(<McpRegistryPage />, { initialEntries: ["/mcp-registry"] });

    await screen.findByText("oauth-server");

    const badgeFor = (cardName: string) =>
      document.querySelector(
        `[data-od-id="mcp-server-card-${cardName}"] [data-od-id="mcp-auth-mode-badge"]`,
      );

    expect(badgeFor("oauth-server")?.textContent).toMatch(/oauth2/i);
    expect(badgeFor("api-key-server")?.textContent).toMatch(/api key/i);
    expect(badgeFor("weather")?.textContent).toMatch(/unknown/i);
  });
});

describe("McpRegistryPage built-in MCP servers", () => {
  it("displays the built-in Composable Agents and RagAnything MCP servers without changing other MCP servers", async () => {
    // Arrange — the deployed config predates the two newest built-in servers.
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
          builtInMcpServers: [
            {
              name: "raganything-files",
              url: "https://ragany.test.com/files/mcp",
              transport: "http",
            },
            {
              name: "raganything-classical",
              url: "https://ragany.test.com/classical/mcp",
              transport: "http",
            },
          ],
        }),
      }),
    );
    mcpApiClient.defaults.adapter = vi.fn(async (config) => ({
      data: [registeredServer],
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));

    // Act — exercise the real page, hooks, repositories, and providers.
    const view = renderWithProviders(<McpRegistryPage />, {
      initialEntries: ["/mcp-registry"],
    });
    const ragServerName = await screen.findByText("raganything-files");
    const builtInSection = ragServerName.closest('[data-od-id="mcp-built-in-section"]');
    expect(builtInSection).not.toBeNull();
    const builtIns = within(builtInSection as HTMLElement);

    // Assert — all built-ins share the existing card actions and badges.
    expect(builtIns.getByText("Composable Agents")).toBeInTheDocument();
    expect(builtIns.getByText("http://api.test.com/mcp")).toBeInTheDocument();
    expect(builtIns.getByText("raganything-classical")).toBeInTheDocument();
    expect(builtIns.getByText("Memories")).toBeInTheDocument();
    expect(builtIns.getByText("https://ragany.test.com/memories/mcp")).toBeInTheDocument();
    expect(builtIns.getByText("Web Search")).toBeInTheDocument();
    expect(builtIns.getByText("https://ragany.test.com/web/mcp")).toBeInTheDocument();
    expect(builtIns.getAllByText("built-in")).toHaveLength(5);
    expect(builtIns.getAllByText("http")).toHaveLength(5);
    expect(builtIns.getAllByRole("button", { name: "Register" })).toHaveLength(5);

    // The registered registry remains unchanged and separate from built-ins.
    expect(screen.getByText("weather")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/mcp")).toBeInTheDocument();
    expect(screen.getByText("1 server")).toBeInTheDocument();

    // A rerender must not append another copy of either built-in.
    view.rerender(<McpRegistryPage />);
    expect(builtIns.getAllByText("Memories")).toHaveLength(1);
    expect(builtIns.getAllByText("Web Search")).toHaveLength(1);
  });
});
