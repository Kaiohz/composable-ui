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

    // REQ-006: Version Mode is scoped to the registry branch only, so it is
    // absent while the create form opens in inline mode; the query must wait
    // for the switch to Registry prompt mode. Latest remains the default
    // when the form enters registry mode.
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));

    const versionGroup = screen.getByRole("radiogroup", {
      name: /version mode/i,
    });
    expect(within(versionGroup).getByRole("radio", { name: /^latest$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

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

/**
 * Spec: fix-agent-prompt-source-ui.md — conditional prompt-source controls.
 *
 * The Prompt Source selector stays visible in every mode (REQ-001) and each
 * mode renders only its own content controls (REQ-002..008):
 *  - registry: Version Mode + Prompt selector (+ Version selector when
 *    Pinned) — System Prompt / System Prompt File must NOT be in the DOM;
 *  - inline: System Prompt textarea only — Version Mode, Prompt, Version and
 *    System Prompt File must NOT be in the DOM;
 *  - file: System Prompt File input only — same exclusions mirrored.
 *
 * Mode switches re-render immediately without submitting (REQ-009). The
 * serialization contract is unchanged (REQ-010): only the active source is
 * submitted. Inactive drafts stay in the form state for the lifetime of the
 * form session and are restored when the user returns to their mode
 * (REQ-011). Edit mode derives the initial mode from the stored config
 * (REQ-012). Registry error/empty scenarios stay scoped to registry mode
 * (REQ-013).
 *
 * Step-1 (Red): System Prompt and System Prompt File currently render in
 * every mode, and handlePromptModeChange wipes their values on switch, so
 * the absence assertions and the draft round-trips below fail.
 */
describe("AgentConfigForm — conditional prompt-source controls", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    promptsState.refetch.mockReset();
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
    promptVersionsState.data = [
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 1 }),
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 2 }),
      createPromptVersion({ prompt_id: "prompt-registry-1", version: 3 }),
    ];
    modelsState.data = [createModelConfiguration({ id: "model-registry-1", name: "Fast Haiku" })];
    modelsState.isLoading = false;
    modelsState.isError = false;
    modelsState.error = undefined;
    agentsState.data = [createAgentConfigMetadata({ name: "other-agent" })];
    registryState.data = undefined;
  });

  /** Presence assertion carrying the control name for precise TDD failures. */
  function expectControl(el: HTMLElement | null, description: string, present: boolean) {
    if (present && !el) {
      throw new Error(`Expected ${description} to be present (not found in the document)`);
    }
    if (!present && el) {
      throw new Error(`Expected ${description} to be absent (found in the document)`);
    }
  }

  /**
   * The exact control set a prompt mode must render. Absent controls must
   * be REMOVED from the DOM (not merely hidden): they are then neither
   * visible nor focusable, and can no longer receive input
   * (REQ-004/006/008, accessibility NFR).
   */
  function expectPromptControls(mode: "registry" | "inline" | "file", pinned = false) {
    expectControl(
      screen.queryByRole("radiogroup", { name: /version mode/i }),
      "the Version Mode toggle",
      mode === "registry",
    );
    expectControl(
      screen.queryByRole("combobox", { name: /^prompt$/i }),
      "the Prompt selector",
      mode === "registry",
    );
    expectControl(
      screen.queryByRole("combobox", { name: /^version$/i }),
      "the Version selector",
      mode === "registry" && pinned,
    );
    expectControl(
      screen.queryByLabelText(/^system prompt$/i),
      "the System Prompt textarea",
      mode === "inline",
    );
    expectControl(
      screen.queryByLabelText(/^system prompt file$/i),
      "the System Prompt File input",
      mode === "file",
    );
  }

  it("registry mode renders Version Mode and the Prompt selector only", async () => {
    // Arrange — the form opens in inline mode by default; switch to registry.
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Act
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));

    // Assert — inline and file controls are removed from the DOM (REQ-004).
    expectPromptControls("registry");
  });

  it("inline mode renders only the System Prompt textarea", () => {
    // Arrange — the create form opens in inline mode: no switch needed.
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Assert — registry and file controls must not exist in the DOM
    // (REQ-005/006: Version Mode included).
    expectPromptControls("inline");
  });

  it("file mode renders only the System Prompt File input", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.click(screen.getByRole("radio", { name: /prompt file/i }));

    // Assert — registry and inline controls must not exist in the DOM
    // (REQ-007/008: Version Mode included).
    expectPromptControls("file");
  });

  it("successive prompt-source switches keep exactly one coherent control set", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // REQ-001: the Prompt Source selector itself stays visible in every mode.
    const sourceGroup = screen.getByRole("radiogroup", { name: /prompt source/i });

    await user.click(within(sourceGroup).getByRole("radio", { name: /registry prompt/i }));
    expectPromptControls("registry");

    await user.click(within(sourceGroup).getByRole("radio", { name: /inline prompt/i }));
    expectPromptControls("inline");

    await user.click(within(sourceGroup).getByRole("radio", { name: /prompt file/i }));
    expectPromptControls("file");

    await user.click(within(sourceGroup).getByRole("radio", { name: /registry prompt/i }));
    expectPromptControls("registry");
  });

  it("prompt-source switches re-render the controls immediately without submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );
    await user.type(screen.getByLabelText(/^agent name$/i), "switcher");

    // Act — each switch updates synchronously with the click: no polling and
    // no form submission (REQ-009).
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    expectPromptControls("registry");
    await user.click(screen.getByRole("radio", { name: /inline prompt/i }));
    expectPromptControls("inline");

    // Assert
    expect(mockSubmit).not.toHaveBeenCalled();
    // Unrelated form state survives the switches untouched.
    expect(screen.getByDisplayValue("switcher")).toBeInTheDocument();
  });

  it("inline draft survives a round trip through another mode within the same session", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Act — type the inline draft, leave for registry, then come back
    // without closing the form (REQ-011).
    await user.type(screen.getByLabelText(/^system prompt$/i), "You are inline.");
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await user.click(screen.getByRole("radio", { name: /inline prompt/i }));

    // Assert
    expect(screen.getByDisplayValue("You are inline.")).toBeInTheDocument();
  });

  it("file draft survives a round trip through another mode within the same session", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Act — type the file path, leave for inline, then come back (REQ-011).
    await user.click(screen.getByRole("radio", { name: /prompt file/i }));
    await user.type(screen.getByLabelText(/^system prompt file$/i), "/prompts/system.txt");
    await user.click(screen.getByRole("radio", { name: /inline prompt/i }));
    await user.click(screen.getByRole("radio", { name: /prompt file/i }));

    // Assert
    expect(screen.getByDisplayValue("/prompts/system.txt")).toBeInTheDocument();
  });

  it("registry prompt selection and pinned version survive a round trip through another mode", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Act — pick a registry prompt with a pinned version, leave, and return
    // (REQ-011 edge case: a Registry selection is restored on return).
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await chooseOption(user, /^prompt$/i, "support-triage");
    await user.click(
      within(screen.getByRole("radiogroup", { name: /version mode/i })).getByRole("radio", {
        name: /^pinned$/i,
      }),
    );
    await chooseOption(user, /^version$/i, "v2");

    await user.click(screen.getByRole("radio", { name: /prompt file/i }));
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));

    // Assert — the selection and the pinned state are restored as they were.
    expect(screen.getByRole("combobox", { name: /^prompt$/i })).toHaveTextContent("support-triage");
    expect(
      within(screen.getByRole("radiogroup", { name: /version mode/i })).getByRole("radio", {
        name: /^pinned$/i,
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("combobox", { name: /^version$/i })).toHaveTextContent("v2");
  });

  it("only the active prompt source is submitted although inactive drafts remain in the form", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Act — draft in every source, then pick registry as the active source
    // and submit. REQ-010: the drafts must stay out of the validated payload
    // even though they are preserved in the local form state.
    await user.type(screen.getByLabelText(/^system prompt$/i), "You are inline.");
    await user.click(screen.getByRole("radio", { name: /prompt file/i }));
    await user.type(screen.getByLabelText(/^system prompt file$/i), "/prompts/system.txt");
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));
    await chooseOption(user, /^prompt$/i, "support-triage");

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await user.type(screen.getByLabelText(/^model$/i), "legacy-model-string");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // Assert
    const payload = formPayload();
    expect(payload.prompt_ref).toEqual({ id: "prompt-registry-1", version: undefined });
    expect(payload.system_prompt).toBeUndefined();
    expect(payload.system_prompt_file).toBeUndefined();
  });

  it("editing a pinned registry agent keeps version controls and hides inline/file fields", () => {
    // Arrange — stored config points to a registry prompt with version 2.
    const initial = createAgentConfig({
      name: "registry-agent",
      system_prompt: undefined,
      system_prompt_file: undefined,
    });
    const augmented = { ...initial, prompt_ref: { id: "prompt-registry-1", version: 2 } };

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={augmented}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    // Assert — edit mode derives its controls from the stored config
    // (REQ-012 edge case) and exposes the pinned version selector.
    expect(screen.getByRole("radio", { name: /registry prompt/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expectPromptControls("registry", true);
    expect(screen.getByRole("combobox", { name: /^version$/i })).toHaveTextContent("v2");
  });

  it("editing a file agent opens file mode with only the System Prompt File control", () => {
    const initial = createAgentConfig({
      name: "file-agent",
      system_prompt: undefined,
      system_prompt_file: "/prompts/system.txt",
    });

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={initial}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    assertSourceMode("file");
    expectPromptControls("file");
    expect(screen.getByDisplayValue("/prompts/system.txt")).toBeInTheDocument();
  });

  it("editing an inline agent opens inline mode with only the System Prompt control", () => {
    // Arrange — no prompt_ref and no system_prompt_file → inline mode.
    const initial = createAgentConfig({
      name: "inline-agent",
      system_prompt_file: undefined,
    });

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={initial}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    assertSourceMode("inline");
    expectPromptControls("inline");
    expect(screen.getByDisplayValue("You are a helpful assistant.")).toBeInTheDocument();
  });

  it("registry load failure keeps the retry scoped to registry mode without restoring inline/file controls", async () => {
    // Arrange
    promptsState.isError = true;
    promptsState.error = new Error("Registry unavailable");
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    // Act
    await user.click(screen.getByRole("radio", { name: /registry prompt/i }));

    // Assert — the failure stays confined to the registry branch (REQ-013):
    // the error and retry remain AND the inline/file controls stay gone.
    expect(screen.getByText(/registry unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(promptsState.refetch).toHaveBeenCalled();
    expectPromptControls("registry");
  });

  it("an unavailable stored prompt reference stays surfaced without restoring inline/file controls", () => {
    // Arrange — stored prompt_ref id is not in the (non-failing) catalog.
    const initial = createAgentConfig({
      name: "orphan-registry-agent",
      system_prompt: undefined,
      system_prompt_file: undefined,
    });
    const augmented = { ...initial, prompt_ref: { id: "prompt-deleted", version: 1 } };

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={augmented}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    // Assert — the pre-existing unavailability notice is preserved and the
    // registry-scoped controls stay alone (REQ-013 error case).
    assertSourceMode("registry");
    expect(screen.getByText(/not in your registry anymore/i)).toBeInTheDocument();
    expectPromptControls("registry", true);
  });

  /** Asserts which prompt-source radio of the selector is checked. */
  function assertSourceMode(mode: "registry" | "inline" | "file") {
    const names: Record<typeof mode, RegExp> = {
      registry: /registry prompt/i,
      inline: /inline prompt/i,
      file: /prompt file/i,
    };
    for (const [key, name] of Object.entries(names)) {
      const radio = screen.getByRole("radio", { name });
      expect(radio).toHaveAttribute("aria-checked", key === mode ? "true" : "false");
    }
  }
});
