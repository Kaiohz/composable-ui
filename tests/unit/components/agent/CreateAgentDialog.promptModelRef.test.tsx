/**
 * Spec: prompts-models-crons-traces.md §AGT-001..AGT-004, §6, §10.5/10.6
 * CreateAgentDialog must serialize the registry selections into the existing
 * multipart YAML create flow:
 *  - Registry prompt + catalog model → YAML includes `prompt_ref` (id [+ version
 *    when pinned]) and `model_ref`, and omits `system_prompt`.
 *  - Inline prompt + legacy custom model → YAML includes
 *    `system_prompt` + `model` and omits `prompt_ref`/`model_ref`.
 *
 * The full real chain runs: dialog → AgentConfigForm → serializeAgentConfig →
 * useCreateAgent mutation (only the data hooks for registries are mocked with
 * the hoisted-bag convention, plus the existing useCreateAgent boundary).
 *
 * Step-1 (Red): neither the form controls nor the YAML serialization exist.
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
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
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
  },
  agentsState: {
    data: undefined as AgentConfigMetadata[] | undefined,
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

describe("CreateAgentDialog — registry selection YAML serialization", () => {
  beforeEach(() => {
    createAgentMutate.mockReset();
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
    agentsState.data = [];
    registryState.data = undefined;
  });

  it("serializes registry prompt (Latest) + catalog model into prompt_ref/model_ref YAML", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "registry-agent");
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await chooseOption(user, /^prompt$/i, "support-triage");
    await user.click(screen.getByRole("radio", { name: /catalog model/i }));
    await chooseOption(user, /^model$/i, "Fast Haiku");

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const doc = await lastYamlText();

    expect(doc.prompt_ref).toEqual({ id: "prompt-registry-1" });
    expect(doc.model_ref).toBe("model-registry-1");
    // Mutually exclusive inline fields cleared from the YAML.
    expect(doc).not.toHaveProperty("system_prompt");
    expect(doc).not.toHaveProperty("system_prompt_file");
  });

  it("pins a version: YAML prompt_ref carries the exact pinned version", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "pinned-agent");
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await chooseOption(user, /^prompt$/i, "support-triage");
    await user.click(screen.getByRole("radio", { name: /^pinned$/i }));
    await chooseOption(user, /^version$/i, "v2");
    await user.click(screen.getByRole("radio", { name: /catalog model/i }));
    await chooseOption(user, /^model$/i, "Fast Haiku");

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const doc = await lastYamlText();
    expect(doc.prompt_ref).toEqual({ id: "prompt-registry-1", version: 2 });
  });

  it("legacy inline + custom mode keeps system_prompt/model and omits refs", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "legacy-agent");
    await user.click(screen.getByRole("radio", { name: /inline prompt/i }));
    await user.type(screen.getByLabelText(/^system prompt$/i), "You are inline.");
    await user.click(screen.getByRole("radio", { name: /custom model/i }));
    await user.type(screen.getByLabelText(/^model$/i), "openai:gpt-4o");

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const doc = await lastYamlText();

    expect(doc.system_prompt).toBe("You are inline.");
    expect(doc.model).toBe("openai:gpt-4o");
    expect(doc).not.toHaveProperty("prompt_ref");
    expect(doc).not.toHaveProperty("model_ref");
  });

  it("mutually exclusive prompt file mode clears system_prompt in YAML", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "file-agent");
    await user.click(screen.getByRole("radio", { name: /prompt file/i }));
    await user.type(screen.getByLabelText(/^system prompt file$/i), "/prompts/system.txt");
    await user.click(screen.getByRole("radio", { name: /custom model/i }));
    await user.type(screen.getByLabelText(/^model$/i), "openai:gpt-4o");

    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgentMutate).toHaveBeenCalled();
    });
    const doc = await lastYamlText();

    expect(doc.system_prompt_file).toBe("/prompts/system.txt");
    expect(doc.system_prompt).toBeUndefined();
    expect(doc).not.toHaveProperty("prompt_ref");
  });

  it("registry selector failure preserves the draft and surfaces a scoped retry", async () => {
    promptsState.isError = true;
    promptsState.error = new Error("Selectors unavailable");
    const user = userEvent.setup();

    renderWithProviders(<CreateAgentDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^agent name$/i), "kept-draft");
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));

    // The registry-health UI is scoped to the registry branch (I8).
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/selectors unavailable/i)).toBeInTheDocument();
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
