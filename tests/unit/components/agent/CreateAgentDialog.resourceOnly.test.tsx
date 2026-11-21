/**
 * Spec: agent-resource-import.md — resource-only creation flow (composable-ui).
 *
 * The real chain runs: CreateAgentDialog → AgentConfigForm →
 * agentConfigToYamlFile (serializeAgentConfig) → useCreateAgent mutation.
 * Only the registry data hooks and the create-agent boundary are mocked with
 * the hoisted-bag convention.
 *
 * Frontend contract (Step-1 Red: no product code exists yet):
 *  - REQ-FORM-001/002: the form path is resource-only — the selections are
 *    serialized as `prompt_ref` / `model_ref` / `mcp_refs`; no inline
 *    definition (`model`, `system_prompt`, `system_prompt_file`,
 *    `mcp_servers` config payload) is ever reintroduced through the UI.
 *  - REQ-MCP-003 / REQ-LEGACY-004: the exported YAML keeps server REFERENCES
 *    and never contains revealed connection parameters or secrets.
 *  - REQ-FORM-005: the dialog refuses to create until a catalog model and a
 *    registry prompt are selected.
 *  - REQ-FORM-004: an empty Prompt Registry shows guidance instead of an
 *    inline fallback.
 *  - REQ-IMPORT-001: the Upload YAML entry point stays available.
 *
 * Existing tests pinning modes REMOVED by this spec (implementation step must
 * replace them): tests/unit/components/agent/CreateAgentDialog.promptModelRef.
 * test.tsx — the inline+custom and file-mode YAML serialization suites.
 */
import { screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import CreateAgentDialog from "@/application/components/agent/CreateAgentDialog";
import type { PromptMetadata } from "../../../fixtures/registries";
import { createPromptMetadata, createModelConfiguration } from "../../../fixtures/registries";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import type { RegisteredMcpServer } from "@/domain/entities/mcpServer/registeredMcpServer";
import yaml from "js-yaml";

const {
  promptsState,
  promptVersionsState,
  modelsState,
  agentsState,
  registryState,
  revealMock,
  createAgentMutate,
} = vi.hoisted(() => ({
  promptsState: {
    data: undefined as PromptMetadata[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  promptVersionsState: {
    data: [] as unknown[],
    isLoading: false,
  },
  modelsState: {
    data: undefined as ReturnType<typeof createModelConfiguration>[] | undefined,
    isLoading: false,
  },
  agentsState: {
    data: undefined as unknown,
    isLoading: false,
  },
  registryState: {
    data: undefined as RegisteredMcpServer[] | undefined,
    isLoading: false,
  },
  revealMock: vi.fn(),
  createAgentMutate: vi.fn(),
}));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => promptsState,
}));

vi.mock("@/application/hooks/prompt/usePromptVersions", () => ({
  usePromptVersions: () => promptVersionsState,
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

vi.mock("@/application/hooks/agent/useCreateAgent", () => ({
  useCreateAgent: () => ({ mutate: createAgentMutate, isPending: false }),
}));

vi.mock("@/infrastructure/api/mcpServer/mcpRegistryApi", () => ({
  mcpRegistryApi: {
    reveal: (name: string) => revealMock(name),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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
];

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionText: string,
) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  await user.click(await screen.findByRole("option", { name: optionText }));
}

async function lastSubmittedYamlDoc(): Promise<{ doc: Record<string, unknown>; raw: string }> {
  const [{ yamlFile }] = createAgentMutate.mock.calls.at(-1) as [{ name: string; yamlFile: File }];
  const raw = await yamlFile.text();
  return { doc: (await yaml.load(raw)) as Record<string, unknown>, raw };
}

describe("CreateAgentDialog — resource-only creation (agent-resource-import)", () => {
  beforeEach(() => {
    createAgentMutate.mockReset();
    revealMock.mockReset();
    revealMock.mockResolvedValue(registryServers[0]);
    promptsState.data = [
      createPromptMetadata({
        id: "prompt-registry-1",
        name: "support-triage",
        latest_version: 3,
      }),
    ];
    promptsState.isLoading = false;
    promptsState.isError = false;
    promptsState.error = undefined;
    modelsState.data = [createModelConfiguration({ id: "model-registry-1", name: "Fast Haiku" })];
    modelsState.isLoading = false;
    agentsState.data = [];
    registryState.data = registryServers;
  });

  it("serializes the resource-only selection into prompt_ref/model_ref/mcp_refs — no inline definitions, no secrets", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "refs-agent");
    await chooseOption(user, /^prompt$/i, "support-triage");
    await chooseOption(user, /^model$/i, "Fast Haiku");

    await user.click(screen.getByRole("button", { name: /mcp servers/i }));
    const pill = await screen.findByRole("button", { name: "weather" });
    await user.click(pill);
    await waitFor(() => expect(pill).toHaveAttribute("aria-pressed", "true"));

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const { doc, raw } = await lastSubmittedYamlDoc();

    // Resource references are kept in the exported YAML.
    expect(doc.prompt_ref).toEqual({ id: "prompt-registry-1" });
    expect(doc.model_ref).toBe("model-registry-1");
    expect(doc.mcp_refs).toEqual(["weather"]);

    // Inline definitions must NOT be reintroduced through the UI.
    expect(doc).not.toHaveProperty("system_prompt");
    expect(doc).not.toHaveProperty("system_prompt_file");
    expect(doc).not.toHaveProperty("model");
    // The legacy list stays present but EMPTY — it carries no server
    // definition, no connection parameter and no secret (review C1).
    expect(doc.mcp_servers).toEqual([]);

    // REQ-LEGACY-004: the export never exposes resolved registry secrets.
    expect(raw).not.toContain("auth_token");
    expect(raw).not.toContain("secret-token");
    expect(raw).not.toContain("https://example.com/mcp");
  });

  it("refuses to create until a registry prompt and a catalog model are selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    // Only the name is provided — no resource selections at all.
    await user.type(screen.getByLabelText(/^agent name$/i), "incomplete-agent");
    await user.click(screen.getByRole("button", { name: /create agent/i }));

    expect(createAgentMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    const alerts = within(dialog)
      .getAllByRole("alert")
      .map((el) => el.textContent ?? "")
      .join(" ");
    // Guidance must cover BOTH required resources.
    expect(alerts).toMatch(/model/i);
    expect(alerts).toMatch(/prompt/i);
  });

  it("REQ-IMPORT-001: keeps the Upload YAML entry point available", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.click(screen.getByText("Upload YAML"));
    expect(screen.getByLabelText(/yaml configuration/i)).toBeInTheDocument();
  });

  it("REQ-FORM-004: an empty prompt registry shows guidance instead of an inline fallback", () => {
    promptsState.data = [];
    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    expect(
      screen.getByText(/no registry prompts|prompts page first|prompt registry/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^system prompt$/i)).not.toBeInTheDocument();
  });
});
