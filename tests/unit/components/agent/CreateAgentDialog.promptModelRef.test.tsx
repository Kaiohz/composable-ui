/**
 * Spec: agent-resource-import.md — resource-only creation flow (composable-ui).
 *
 * The real chain runs: CreateAgentDialog → AgentConfigForm →
 * agentConfigToYamlFile (serializeAgentConfig) → useCreateAgent mutation.
 * Only the registry data hooks and the create-agent boundary are mocked with
 * the hoisted-bag convention.
 *
 * The inline+custom and file-mode YAML serialization suites were REPLACED by
 * the resource-only contracts (tests/unit/components/agent/
 * CreateAgentDialog.resourceOnly.test.tsx — REQ-FORM-001/002): there is no
 * inline prompt, prompt file or custom model mode to serialize anymore. What
 * remains valid (kept here):
 *  - a registry prompt + a catalog model → YAML keeps `prompt_ref` (id [+
 *    version when pinned]) and `model_ref`, and never re-emits the inline
 *    fields;
 *  - pinned-version serialization carries the exact immutable version;
 *  - a prompt-registry load failure preserves the draft and surfaces a
 *    scoped retry;
 *  - no model credential controls of any kind.
 */
import { screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import CreateAgentDialog from "@/application/components/agent/CreateAgentDialog";
import type { PromptMetadata } from "../../../fixtures/registries";
import {
  createPromptMetadata,
  createPromptVersion,
  createModelConfiguration,
} from "../../../fixtures/registries";
import yaml from "js-yaml";

const {
  promptsState,
  promptVersionsState,
  modelsState,
  agentsState,
  registryState,
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
    data: undefined as Array<ReturnType<typeof createPromptVersion>> | undefined,
    isLoading: false,
  },
  modelsState: {
    data: undefined as Array<ReturnType<typeof createModelConfiguration>> | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
  },
  agentsState: {
    data: [],
    isLoading: false,
  },
  registryState: {
    data: undefined as unknown,
    isLoading: false,
  },
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

async function lastYamlText(): Promise<Record<string, unknown>> {
  const [{ yamlFile }] = createAgentMutate.mock.calls.at(-1) as [{ name: string; yamlFile: File }];
  const text = await yamlFile.text();
  return yaml.load(text) as Record<string, unknown>;
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionText: string,
) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  await user.click(await screen.findByRole("option", { name: optionText }));
}

describe("CreateAgentDialog — resource selection YAML serialization", () => {
  beforeEach(() => {
    createAgentMutate.mockReset();
    promptsState.refetch.mockReset();
    promptsState.data = [
      createPromptMetadata({
        id: "prompt-registry-1",
        name: "support-triage",
        latest_version: 3,
      }),
    ];
    promptVersionsState.data = [
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 1 }),
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 2 }),
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 3 }),
    ];
    modelsState.data = [createModelConfiguration({ id: "model-registry-1", name: "Fast Haiku" })];
    modelsState.isLoading = false;
    modelsState.isError = false;
    modelsState.error = undefined;
    agentsState.data = [];
    registryState.data = undefined;
  });

  it("serializes the registry selection into prompt_ref/model_ref YAML with no inline fields", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "registry-agent");
    await chooseOption(user, /^prompt$/i, "support-triage");
    await chooseOption(user, /^model$/i, "Fast Haiku");

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const doc = await lastYamlText();

    expect(doc.prompt_ref).toEqual({ id: "prompt-registry-1" });
    expect(doc.model_ref).toBe("model-registry-1");
    // The legacy inline fields are never emitted: the registries are the
    // only sources (REQ-FORM-001/002).
    expect(doc).not.toHaveProperty("system_prompt");
    expect(doc).not.toHaveProperty("system_prompt_file");
    expect(doc).not.toHaveProperty("model");
    // The legacy MCP list stays present but EMPTY — no server definition,
    // no connection parameter and no secret (review C1).
    expect(doc.mcp_servers).toEqual([]);
  });

  it("pins a version: YAML prompt_ref carries the exact pinned version", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "pinned-agent");
    await chooseOption(user, /^prompt$/i, "support-triage");
    await user.click(
      within(screen.getByRole("radiogroup", { name: /version mode/i })).getByRole("radio", {
        name: /^pinned$/i,
      }),
    );
    await chooseOption(user, /^version$/i, "v2");
    await chooseOption(user, /^model$/i, "Fast Haiku");

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const doc = await lastYamlText();
    expect(doc.prompt_ref).toEqual({ id: "prompt-registry-1", version: 2 });
  });

  it("registry selector failure preserves the draft and surfaces a scoped retry", async () => {
    promptsState.isError = true;
    promptsState.error = new Error("Selectors unavailable");
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "kept-draft");

    expect(
      within(screen.getByRole("dialog")).getByText(/selectors unavailable/i),
    ).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /retry/i }));
    expect(promptsState.refetch).toHaveBeenCalled();
    expect(screen.getByDisplayValue("kept-draft")).toBeInTheDocument();
  });

  it("create mode introduces no model credential controls", () => {
    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    expect(
      screen.queryByLabelText(/api key|token|secret|credential|password/i),
    ).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});
