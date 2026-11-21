/**
 * Spec: agent-resource-import.md — resource-only agent forms (composable-ui).
 *
 * Frontend contract under test (Step-1 Red: no product code exists yet):
 *
 *  - REQ-FORM-001  Model Catalog: the ONLY model source. The "Custom model"
 *    mode, its mode toggle and any free-form `model` string entry are removed
 *    from the manual path.
 *  - REQ-FORM-002  Prompt Registry: the ONLY prompt source. "Inline prompt"
 *    and "Prompt file" modes are removed; Latest/Pinned stays.
 *  - REQ-FORM-003/REQ-MCP-003  MCP: selection of REGISTERED servers only (no
 *    free-form URL/command/headers/env/token entry), and the submitted
 *    payload carries server REFERENCES (`mcp_refs`) — never the revealed
 *    connection parameters or secrets.
 *  - REQ-FORM-004  Empty registries show guidance to create the resource
 *    first; saving never proposes an inline fallback.
 *  - REQ-FORM-005  Creating a custom agent REQUIRES a catalog model and a
 *    registry prompt; an MCP selection is optional.
 *  - REQ-BUILTIN-001/002  The built-in customization exposes the SAME MCP
 *    registry selector (registered servers only) and restores a saved
 *    selection.
 *  - REQ-BUILTIN-005  A non-customized built-in keeps saving with platform
 *    defaults — it is NOT subject to the required model/prompt rule.
 *  - REQ-LEGACY-002  Editing a legacy inline agent requires conversion: the
 *    inline values are NOT presented as registered resources and the save is
 *    refused until registered model/prompt selections exist.
 *
 * Existing tests pinning modes REMOVED by this spec (implementation step must
 * replace them — their assertions must NOT be preserved):
 *  - tests/unit/components/agent/AgentConfigForm.test.tsx
 *      · edit mode "pre-fills form with existing data" asserts the legacy
 *        free-form `model` input value (removed by REQ-FORM-001);
 *      · "built-in mode → hides server-managed sections" contradicts
 *        REQ-BUILTIN-001 (the MCP section becomes VISIBLE).
 *  - tests/unit/components/agent/AgentConfigForm.promptModelRef.test.tsx —
 *    all mode-toggle, inline/file control-set and draft round-trip suites pin
 *    modes removed by REQ-FORM-001/002.
 *  - tests/unit/components/agent/CreateAgentDialog.promptModelRef.test.tsx —
 *    inline+custom and file-mode YAML serialization tests likewise pin
 *    removed modes.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import AgentConfigForm from "@/application/components/agent/AgentConfigForm";
import type { PromptMetadata } from "../../../fixtures/registries";
import {
  createPromptMetadata,
  createPromptVersion,
  createModelConfiguration,
} from "../../../fixtures/registries";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import { BackendType } from "@/domain/entities/agent/agentConfig";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import type { RegisteredMcpServer } from "@/domain/entities/mcpServer/registeredMcpServer";

const { promptsState, promptVersionsState, modelsState, agentsState, registryState, revealMock } =
  vi.hoisted(() => ({
    promptsState: {
      data: undefined as PromptMetadata[] | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    promptVersionsState: {
      data: undefined as ReturnType<typeof createPromptVersion>[] | undefined,
      isLoading: false,
    },
    modelsState: {
      data: undefined as ReturnType<typeof createModelConfiguration>[] | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    agentsState: {
      data: undefined as AgentConfigMetadata[] | undefined,
      isLoading: false,
    },
    registryState: {
      data: undefined as RegisteredMcpServer[] | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    revealMock: vi.fn(),
  }));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => promptsState,
}));

vi.mock("@/application/hooks/prompt/usePromptVersions", () => ({
  usePromptVersions: (_promptId: string | null, _opts?: unknown) => promptVersionsState,
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => modelsState,
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => agentsState,
}));

vi.mock("@/application/hooks/mcpServer/useMcpRegistry", () => ({
  useMcpRegistry: () => registryState,
}));

vi.mock("@/infrastructure/api/mcpServer/mcpRegistryApi", () => ({
  mcpRegistryApi: {
    reveal: (name: string) => revealMock(name),
  },
}));

const mockSubmit = vi.fn();
const mockCancel = vi.fn();

const registryServers: RegisteredMcpServer[] = [
  {
    name: "weather",
    transport: McpTransportType.HTTP,
    url: "https://example.com/mcp",
    headers: { Authorization: "Bearer secret-header" },
    env: {},
    auth_token: "secret-token",
    tool_count: 5,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source_type: "external",
    openapi_url: null,
  },
  {
    name: "github",
    transport: McpTransportType.HTTP,
    url: "https://api.github.com/mcp",
    headers: {},
    env: {},
    auth_token: null,
    tool_count: 12,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source_type: "external",
    openapi_url: null,
  },
];

/** Registered-server identity the persisted selection must carry. */
const WEATHER_REVEALED = {
  name: "weather",
  transport: McpTransportType.HTTP,
  command: undefined,
  args: [],
  url: "https://example.com/mcp",
  headers: { Authorization: "Bearer secret-header" },
  env: {},
  auth_token: "secret-token",
};

const BUILTIN_PLATFORM_DEFAULTS: AgentConfig = {
  name: "composable-ai-assistant",
  tools: [],
  backend: { type: BackendType.STORE, checkpoint_backend: "memory" },
  hitl: { rules: {} },
  memory: [],
  skills: [],
  subagents: [],
  mcp_servers: [],
  debug: false,
  is_builtin: true,
  is_customized: false,
};

async function chooseCatalogModel(user: ReturnType<typeof userEvent.setup>, option = "Fast Haiku") {
  await user.click(screen.getByRole("combobox", { name: /^model$/i }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function chooseRegistryPrompt(
  user: ReturnType<typeof userEvent.setup>,
  option = "support-triage",
) {
  await user.click(screen.getByRole("combobox", { name: /^prompt$/i }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function joinedAlerts(): string {
  return screen
    .getAllByRole("alert")
    .map((el) => el.textContent ?? "")
    .join(" ");
}

describe("AgentConfigForm — resource-only model & prompt sources", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    revealMock.mockReset();
    promptsState.data = [
      createPromptMetadata({
        id: "prompt-registry-1",
        name: "support-triage",
        latest_version: 3,
      }),
      createPromptMetadata({ id: "prompt-registry-2", name: "release-notes", latest_version: 1 }),
    ];
    promptsState.isLoading = false;
    promptsState.isError = false;
    promptsState.error = undefined;
    promptVersionsState.data = [
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 1 }),
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 2 }),
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 3 }),
    ];
    modelsState.data = [
      createModelConfiguration({
        id: "model-registry-1",
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
      }),
    ];
    modelsState.isLoading = false;
    modelsState.isError = false;
    modelsState.error = undefined;
    agentsState.data = [];
    registryState.data = undefined;
  });

  it("REQ-FORM-001: offers NO Custom model mode — the catalog is the only model source", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // No mode selector may ever present a "Custom model" choice anywhere.
    expect(screen.queryByText(/custom model/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /custom model/i })).not.toBeInTheDocument();
  });

  it("REQ-FORM-001: renders NO free-form model string input", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // The legacy custom-model string field must be gone; only the catalog
    // selector may carry the "Model" label.
    expect(screen.queryByRole("textbox", { name: /^model$/i })).not.toBeInTheDocument();
  });

  it("REQ-FORM-002: offers NO inline prompt or prompt file modes — the registry is the only prompt source", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(screen.queryByRole("radio", { name: /inline prompt/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /prompt file/i })).not.toBeInTheDocument();
  });

  it("REQ-FORM-002: renders NO free-form system prompt textarea in any create mode", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(screen.queryByLabelText(/^system prompt$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^system prompt file$/i)).not.toBeInTheDocument();
  });

  it("REQ-FORM-001/002: catalog model and registry prompt selectors are usable straight away on create", async () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Both resource selectors must be present without any mode switch —
    // resource-only means there is nothing to switch away from.
    expect(screen.getByRole("combobox", { name: /^model$/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^prompt$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^agent name$/i)).toBeInTheDocument();
  });

  it("REQ-FORM-005: refuses the submit when no catalog model is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await chooseRegistryPrompt(user);
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(joinedAlerts()).toMatch(/model/i);
  });

  it("REQ-FORM-005: refuses the submit when no registry prompt is selected — even with a catalog model chosen", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await chooseCatalogModel(user);
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(joinedAlerts()).toMatch(/prompt/i);
  });

  it("REQ-FORM-005: an MCP selection is optional for custom creation", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await chooseCatalogModel(user);
    await chooseRegistryPrompt(user);
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "new-agent",
        model_ref: "model-registry-1",
      }),
    );
  });
});

describe("AgentConfigForm — empty registries guidance (REQ-FORM-004)", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    revealMock.mockReset();
    promptsState.isLoading = false;
    promptsState.isError = false;
    promptsState.error = undefined;
    promptVersionsState.data = [];
    modelsState.isLoading = false;
    modelsState.isError = false;
    modelsState.error = undefined;
    agentsState.data = [];
    registryState.data = undefined;
  });

  it("guides the user to create a prompt first when the Prompt Registry is empty", () => {
    promptsState.data = [];
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(
      screen.getByText(/no registry prompts|prompts page first|prompt registry/i),
    ).toBeInTheDocument();
  });

  it("guides the user to create a model first when the Model Catalog is empty", () => {
    modelsState.data = [];
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(screen.getByText(/models page first|no catalog models/i)).toBeInTheDocument();
  });

  it("never proposes an inline fallback when the registries are empty", async () => {
    promptsState.data = [];
    modelsState.data = [];
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "fallback-agent");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^system prompt$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^model$/i })).not.toBeInTheDocument();
  });
});

describe("AgentConfigForm — built-in MCP selector (REQ-BUILTIN-001/002)", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    revealMock.mockReset();
    promptsState.data = [
      createPromptMetadata({ id: "prompt-registry-1", name: "support-triage", latest_version: 1 }),
    ];
    promptVersionsState.data = [];
    modelsState.data = [createModelConfiguration({ id: "model-registry-1", name: "Fast Haiku" })];
    modelsState.isLoading = false;
    agentsState.data = [];
    registryState.data = registryServers;
  });

  it("REQ-BUILTIN-001: exposes the MCP registry selector in the built-in customization", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={BUILTIN_PLATFORM_DEFAULTS}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        isBuiltin
      />,
    );

    const trigger = screen.getByRole("button", { name: /mcp servers/i });
    await user.click(trigger);

    // Only REGISTERED servers are offered — no free-form server entry.
    expect(await screen.findByRole("button", { name: "weather" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "github" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add mcp server/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/server url|command|auth token/i)).not.toBeInTheDocument();
  });

  it("REQ-FORM-004: shows empty-registry guidance for the built-in", async () => {
    registryState.data = [];
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={BUILTIN_PLATFORM_DEFAULTS}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        isBuiltin
      />,
    );

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));
    expect(screen.getByText(/mcp registry page first|no registered servers/i)).toBeInTheDocument();
  });

  it("REQ-BUILTIN-002: restores a previously persisted selection as active pills", async () => {
    const user = userEvent.setup();
    const customized: AgentConfig = {
      ...BUILTIN_PLATFORM_DEFAULTS,
      is_customized: true,
      // Legacy payload shape AND the future reference shape — the saved
      // selection must surface either way.
      mcp_servers: [WEATHER_REVEALED],
      mcp_refs: ["weather"],
    } as unknown as AgentConfig;

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={customized}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        isBuiltin
      />,
    );

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));
    const pill = await screen.findByRole("button", { name: "weather" });
    expect(pill).toHaveAttribute("aria-pressed", "true");
  });

  it("REQ-BUILTIN-005: a non-customized built-in saves with its platform defaults — no model/prompt selections required", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={BUILTIN_PLATFORM_DEFAULTS}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        isBuiltin
      />,
    );

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "composable-ai-assistant" }),
    );
    // The built-in keeps every platform default: no resource reference is
    // introduced and no legacy inline field is emitted (review I7).
    const payload = mockSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain("model_ref");
    expect(JSON.stringify(payload)).not.toContain("prompt_ref");
    expect(JSON.stringify(payload)).not.toContain("model");
    expect(JSON.stringify(payload)).not.toContain("system_prompt");
    expect(JSON.stringify(payload)).not.toContain("legacy");
    // The MCP selection is the resource-only identity list (empty here).
    expect(payload.mcp_refs).toEqual([]);
    expect(payload.mcp_servers).toEqual([]);
  });
});

describe("AgentConfigForm — MCP selection carries references, not configs (REQ-MCP-003 / REQ-FORM-003)", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    registryState.data = registryServers;
    registryState.isLoading = false;
    registryState.isError = false;
    registryState.error = undefined;
    promptsState.data = [
      createPromptMetadata({ id: "prompt-registry-1", name: "support-triage", latest_version: 1 }),
    ];
    promptVersionsState.data = [];
    modelsState.data = [createModelConfiguration({ id: "model-registry-1", name: "Fast Haiku" })];
    modelsState.isLoading = false;
    agentsState.data = [];
    revealMock.mockResolvedValue(registryServers[0]);
  });

  it("submits only the selected server names — never their revealed connection parameters or secrets", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "mcp-agent");
    await chooseCatalogModel(user);
    await chooseRegistryPrompt(user);

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));
    const pill = await screen.findByRole("button", { name: "weather" });
    await user.click(pill);
    await waitFor(() => expect(pill).toHaveAttribute("aria-pressed", "true"));

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = mockSubmit.mock.calls[0][0] as Record<string, unknown>;
    // The persisted selection is a REFERENCE, not an embedded config.
    expect(payload.mcp_refs).toEqual(["weather"]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("auth_token");
    expect(serialized).not.toContain("https://example.com/mcp");
    expect(serialized).not.toContain("secret-token");
  });

  it("editing a legacy agent with an inline mcp_servers entry does not re-embed it on save", async () => {
    const user = userEvent.setup();
    const legacy: AgentConfig = {
      name: "legacy-mcp-agent",
      model: "openai:gpt-4o",
      system_prompt: "You are helpful",
      tools: [],
      backend: { type: BackendType.STORE, checkpoint_backend: "memory" },
      hitl: { rules: {} },
      memory: [],
      skills: [],
      subagents: [],
      mcp_servers: [
        {
          name: "legacy-local",
          transport: McpTransportType.STDIO,
          command: "npx",
          args: [],
          headers: {},
          env: {},
          auth_token: undefined,
        },
      ],
      debug: false,
    };

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={legacy}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "legacy-mcp-agent");
    await chooseCatalogModel(user);
    await chooseRegistryPrompt(user);

    // The unregistered selection is not silent: the pill states its
    // consequence and the section surfaces the drop feedback (review I2).
    await user.click(screen.getByRole("button", { name: /mcp servers/i }));
    const pill = await screen.findByRole("button", {
      name: /legacy-local \(not registered — will be dropped\)/i,
    });
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(
        /1 selected MCP server is no longer registered and will be removed from this agent on save/i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    const payload = mockSubmit.mock.calls[0][0] as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    // The legacy inline definition is not presented as a registered resource
    // and must not leak back into the saved configuration.
    expect(serialized).not.toContain("legacy-local");
    expect(serialized).not.toContain('["npx"]');
  });

  it("shows the loading state instead of empty-registry guidance while the MCP registry loads (review I1)", async () => {
    registryState.data = undefined;
    registryState.isLoading = true;
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: /mcp servers/i }));

    expect(screen.getByText(/loading mcp registry/i)).toBeInTheDocument();
    expect(screen.queryByText(/no registered servers\. add servers/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error instead of empty-registry guidance when the MCP registry fails (review I1)", async () => {
    registryState.data = undefined;
    registryState.isError = true;
    registryState.error = new Error("MCP Registry unavailable");
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));

    expect(screen.getByText(/mcp registry unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/no registered servers\. add servers/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(registryState.refetch).toHaveBeenCalled();
  });

  it("keeps the current selection visible and editable while the MCP registry loads (review J3)", async () => {
    registryState.data = undefined;
    registryState.isLoading = true;
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={{
          ...BUILTIN_PLATFORM_DEFAULTS,
          name: "selection-agent",
          is_builtin: false,
          is_customized: false,
          mcp_refs: ["weather"],
        }}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));

    // Loading feedback AND the selection: the pill group stays reachable so
    // the upcoming save cannot silently erase the selection (J3 — the
    // selection is kept verbatim while the registry list is unavailable).
    expect(screen.getByText(/loading mcp registry/i)).toBeInTheDocument();
    const pill = await screen.findByRole("button", { name: /weather/i });
    await user.click(pill);
    // The deselected unregistered pill disappears entirely (it was rendered
    // only because it was selected) — the selection is editable throughout.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /weather/i })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/no registered servers\. add servers/i)).not.toBeInTheDocument();
  });

  it("keeps the current selection visible and editable while the MCP registry fails (review J3)", async () => {
    registryState.data = undefined;
    registryState.isError = true;
    registryState.error = new Error("MCP Registry unavailable");
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={{
          ...BUILTIN_PLATFORM_DEFAULTS,
          name: "failed-registry-agent",
          is_builtin: false,
          is_customized: false,
          mcp_refs: ["weather", "github"],
        }}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));

    // Error strip AND both saved selections — deselecting one removes it,
    // while the other survives; the registry state is not silently erased.
    expect(screen.getByText(/mcp registry unavailable/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /weather/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /weather/i }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /weather/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.queryByText(/no registered servers\. add servers/i)).not.toBeInTheDocument();
  });

  it("gives the unregistered-pill group an accessible name (review I9)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));

    expect(screen.getByRole("group", { name: /registered mcp servers/i })).toBeInTheDocument();
  });
});
