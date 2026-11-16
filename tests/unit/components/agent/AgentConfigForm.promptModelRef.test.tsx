/**
 * Spec: prompts-models-crons-traces.md §AGT-001..AGT-004 (Agent create/edit)
 * AgentConfigForm must expose:
 *  - Prompt source modes: Registry prompt / Inline prompt / Prompt file
 *    (mutually exclusive; SegmentedToggle-style radio primitives are the
 *    existing pattern for exclusive choices).
 *  - Registry mode: single-select prompt selector + Version mode
 *    (Latest | Pinned); Pinned reveals a numeric version selector populated
 *    from that prompt's immutable history.
 *  - Model source modes: Catalog model / Legacy custom model string.
 *  - Submit serializes the selection into the existing YAML flow; switching
 *    modes clears mutually exclusive fields in the submitted payload.
 *  - Registry load failure: retryable error; draft preserved.
 *  - No model credential controls of any kind.
 *
 * Data-hook contract Step 2 must implement (hoisted-bag mock convention):
 *  - @/application/hooks/prompt/usePrompts            → {data: PromptMetadata[], isLoading, isError, error, refetch}
 *  - @/application/hooks/prompt/usePromptVersions     → (promptId | null, {enabled}) → {data: PromptVersion[], isLoading}
 *  - @/application/hooks/model/useModels              → {data: ModelConfiguration[], isLoading, isError, error, refetch}
 *
 * Step-1 (Red): the hooks exist only as this contract; the form has neither
 * source toggles nor registry selectors yet.
 */
import { screen } from "@testing-library/react";
import { within } from "@testing-library/dom";
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
import { createAgentConfigMetadata, createAgentConfig } from "../../../fixtures/external";
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSubmit = vi.fn();
const mockCancel = vi.fn();

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionText: string,
) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  await user.click(await screen.findByRole("option", { name: optionText }));
}

function formPayload(): Record<string, unknown> {
  expect(mockSubmit).toHaveBeenCalled();
  return mockSubmit.mock.calls[0][0] as Record<string, unknown>;
}

/**
 * Expands a collapsed (if any) accordion section. Radix removes collapsed
 * accordion content from the DOM, so error assertions first open the
 * candidate sections without toggling already-open ones.
 */
async function ensureSectionOpen(user: ReturnType<typeof userEvent.setup>, labels: RegExp[]) {
  for (const label of labels) {
    const trigger = screen.queryByRole("button", { name: label });
    if (trigger && trigger.getAttribute("aria-expanded") === "false") {
      await user.click(trigger);
    }
  }
}

describe("AgentConfigForm — prompt & model registry selectors", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    revealMock.mockReset();
    promptsState.refetch.mockReset();
    promptsState.data = [
      createPromptMetadata({
        id: "prompt-registry-1",
        name: "support-triage",
        latest_version: 3,
      }),
      createPromptMetadata({
        id: "prompt-registry-2",
        name: "release-notes",
        latest_version: 1,
      }),
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
    agentsState.data = [createAgentConfigMetadata({ name: "other-agent" })];
    registryState.data = undefined;
  });

  it("offers the three prompt source modes as a mutually exclusive radio group", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    const group = screen.getByRole("radiogroup", { name: /prompt source/i });
    expect(within(group).getByRole("radio", { name: /registry prompt/i })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /inline prompt/i })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /prompt file/i })).toBeInTheDocument();
  });

  it("offers catalog vs legacy custom model source modes", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    const group = screen.getByRole("radiogroup", { name: /model source/i });
    expect(within(group).getByRole("radio", { name: /catalog model/i })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /custom model/i })).toBeInTheDocument();
  });

  it("registry prompt mode exposes a single-select prompt selector from the user's registry", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));

    await chooseOption(user, /^prompt$/i, "support-triage");

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.type(screen.getByLabelText(/^model$/i), "legacy-model-string");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = formPayload();
    expect(payload.prompt_ref).toEqual({
      id: "prompt-registry-1",
      version: undefined,
    });
  });

  it("version mode defaults to Latest and a pinned selection submits that version", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    const versionGroup = screen.getByRole("radiogroup", {
      name: /version mode/i,
    });
    expect(within(versionGroup).getByRole("radio", { name: /^latest$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await chooseOption(user, /^prompt$/i, "support-triage");
    await user.click(within(versionGroup).getByRole("radio", { name: /^pinned$/i }));

    // Numeric version selector populated from that prompt's history.
    await chooseOption(user, /^version$/i, "v2");

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.type(screen.getByLabelText(/^model$/i), "legacy-model-string");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(formPayload().prompt_ref).toEqual({
      id: "prompt-registry-1",
      version: 2,
    });
  });

  it("registry prompt mode clears inline prompt fields in the submitted payload", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await chooseOption(user, /^prompt$/i, "release-notes");

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.type(screen.getByLabelText(/^model$/i), "legacy-model-string");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = formPayload();
    expect(payload.prompt_ref).toBeDefined();
    // Mutually exclusive fields stay cleared in the submitted payload even
    // if the legacy controls remain elsewhere in the form.
    expect(payload.system_prompt).toBeUndefined();
    expect(payload.system_prompt_file).toBeUndefined();
  });

  it("inline prompt mode submits system_prompt and no prompt_ref", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("radio", { name: /inline prompt/i }));

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.type(screen.getByLabelText(/^model$/i), "legacy-model-string");
    await user.type(screen.getByLabelText(/^system prompt$/i), "You are inline.");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = formPayload();
    expect(payload.system_prompt).toBe("You are inline.");
    expect(payload.prompt_ref).toBeUndefined();
    expect(payload.model_ref).toBeUndefined();
  });

  it("catalog model mode submits model_ref", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("radio", { name: /catalog model/i }));
    await chooseOption(user, /^model$/i, "Fast Haiku");

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = formPayload();
    expect(payload.model_ref).toBe("model-registry-1");
  });

  it("legacy custom mode submits the model string and no model_ref", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("radio", { name: /custom model/i }));

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.type(screen.getByLabelText(/^model$/i), "openai:gpt-4o");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = formPayload();
    expect(payload.model).toBe("openai:gpt-4o");
    expect(payload.model_ref).toBeUndefined();
  });

  it("catalog mode introduces no model credential controls", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(
      screen.queryByLabelText(/api key|token|secret|credential|password/i),
    ).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("registry load failure shows a retryable error scoped to registry mode without losing the draft", async () => {
    promptsState.isError = true;
    promptsState.error = new Error("Registry unavailable");
    const user = userEvent.setup();

    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "draft-agent");
    await ensureSectionOpen(user, [/prompt source/i]);

    // The registry-health UI is scoped to the registry branch (I8): an
    // inline/file prompt does not depend on the registry.
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    expect(screen.getByText(/registry unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(promptsState.refetch).toHaveBeenCalled();

    // Draft preserved.
    expect(screen.getByDisplayValue("draft-agent")).toBeInTheDocument();
  });

  it("edit mode keeps the registry mode and shows an explicit error for an inaccessible prompt reference", () => {
    const initial = createAgentConfig({ name: "legacy-inline-agent" });
    // Step-2 shape: the serialized AgentConfig gains prompt_ref/model_ref.
    const augmented = {
      ...initial,
      prompt_ref: { id: "prompt-deleted", version: 1 },
    } as unknown as typeof initial;

    promptsState.isError = true;
    promptsState.error = new Error("Prompt no longer accessible");

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={augmented}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    // Not silently switched to inline/file — the registry selector stays.
    expect(screen.getByRole("radio", { name: /registry prompt/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    return (async () => {
      const user = userEvent.setup();
      await ensureSectionOpen(user, [/system prompt/i, /prompt source/i]);
      expect(screen.getByText(/no longer accessible/i)).toBeInTheDocument();
    })();
  });
});
