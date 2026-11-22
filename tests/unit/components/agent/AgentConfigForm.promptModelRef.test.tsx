/**
 * Spec: agent-resource-import.md — resource-only agent form (composable-ui).
 *
 * REQ-FORM-001/002: the Model Catalog and the Prompt Registry are the ONLY
 * sources — the "Custom model", "Inline prompt" and "Prompt file" modes are
 * REMOVED from the manual path, so no suite pins them anymore. What remains
 * valid (kept here):
 *  - a single-select prompt selector fed by the user's Prompt Registry;
 *  - version semantics: Latest by default; a pinned selection submits the
 *    exact immutable version;
 *  - the submitted payload carries prompt_ref/model_ref and NEVER the legacy
 *    inline fields, even when an agent being edited still holds them
 *    (REQ-LEGACY-002 — conversion through resource selection);
 *  - registry load failure: retryable error, draft preserved;
 *  - no model credential controls of any kind.
 *
 * Data-hook contract (hoisted-bag mock convention):
 *  - @/application/hooks/prompt/usePrompts            → {data, isLoading, isError, error, refetch}
 *  - @/application/hooks/prompt/usePromptVersions     → (promptId | null, opts?) → {data, isLoading}
 *  - @/application/hooks/model/useModels              → {data, isLoading, isError, error, refetch}
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
import { createAgentConfig } from "../../../fixtures/external";

const { promptsState, promptVersionsState, modelsState, agentsState, registryState } = vi.hoisted(
  () => ({
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
      data: [],
      isLoading: false,
    },
    registryState: {
      data: undefined as unknown,
      isLoading: false,
    },
  }),
);

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

async function fillRequiredResources(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText(/^agent name$/i), name);
  await chooseOption(user, /^prompt$/i, "support-triage");
  await chooseOption(user, /^model$/i, "Fast Haiku");
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

describe("AgentConfigForm — prompt & model registry selectors (resource-only)", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockCancel.mockReset();
    promptsState.refetch.mockReset();
    modelsState.refetch.mockReset();
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
    agentsState.data = [];
    registryState.data = undefined;
  });

  it("the registries are the only sources: single-select controls with no source modes", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(screen.getByRole("combobox", { name: /^prompt$/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^model$/i })).toBeInTheDocument();
    // Modes removed by REQ-FORM-001/002 are gone from the DOM entirely.
    expect(screen.queryByRole("radiogroup", { name: /prompt source/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /model source/i })).not.toBeInTheDocument();
  });

  it("a registry prompt selection submits prompt_ref with Latest as the default", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await fillRequiredResources(user, "new-agent");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(formPayload().prompt_ref).toEqual({
      id: "prompt-registry-1",
      version: undefined,
    });
  });

  it("a pinned selection submits the exact immutable version", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "new-agent");
    await chooseOption(user, /^prompt$/i, "support-triage");

    // Latest is the default of the Version Mode radio group.
    const versionGroup = screen.getByRole("radiogroup", {
      name: /version mode/i,
    });
    expect(within(versionGroup).getByRole("radio", { name: /^latest$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(within(versionGroup).getByRole("radio", { name: /^pinned$/i }));
    await chooseOption(user, /^version$/i, "v2");
    await chooseOption(user, /^model$/i, "Fast Haiku");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(formPayload().prompt_ref).toEqual({
      id: "prompt-registry-1",
      version: 2,
    });
  });

  it("the submitted payload never carries the legacy inline prompt/model fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await fillRequiredResources(user, "new-agent");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const payload = formPayload();
    expect(payload.prompt_ref).toBeDefined();
    expect(payload.model_ref).toBe("model-registry-1");
    expect(payload.system_prompt).toBeUndefined();
    expect(payload.system_prompt_file).toBeUndefined();
    expect(payload.model).toBeUndefined();
  });

  it("editing a legacy inline agent converts it: save refused until both resources are selected", async () => {
    const user = userEvent.setup();
    // Inline legacy agent (REQ-LEGACY-001 shape) — opened for edit.
    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={createAgentConfig({ name: "legacy-inline-agent" })}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    // The inline value must NOT surface as a registered resource.
    expect(screen.getByRole("combobox", { name: /^prompt$/i })).toHaveTextContent(
      /select a registry prompt/i,
    );
    expect(screen.getByRole("combobox", { name: /^model$/i })).toHaveTextContent(
      /select a catalog model/i,
    );

    // The name input is disabled in edit mode; submitting without selections
    // is refused (REQ-LEGACY-002) with guidance on both resources.
    await user.click(screen.getByRole("button", { name: /^update$/i }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/prompt is required when no registry prompt_ref is provided/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/model is required when no catalog model_ref is provided/i),
    ).toBeInTheDocument();

    // Converting through resource selection unblocks the save.
    await chooseOption(user, /^prompt$/i, "support-triage");
    await chooseOption(user, /^model$/i, "Fast Haiku");
    await user.click(screen.getByRole("button", { name: /^update$/i }));
    expect(mockSubmit).toHaveBeenCalled();
  });

  it("introduces no model credential controls", () => {
    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    expect(
      screen.queryByLabelText(/api key|token|secret|credential|password/i),
    ).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("registry load failure shows a retryable error without losing the draft", async () => {
    promptsState.isError = true;
    promptsState.error = new Error("Registry unavailable");
    const user = userEvent.setup();

    renderWithProviders(
      <AgentConfigForm mode="create" onSubmit={mockSubmit} onCancel={mockCancel} />,
    );

    await user.type(screen.getByLabelText(/^agent name$/i), "draft-agent");
    await ensureSectionOpen(user, [/prompt source/i]);

    expect(screen.getByText(/registry unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(promptsState.refetch).toHaveBeenCalled();

    // Draft preserved.
    expect(screen.getByDisplayValue("draft-agent")).toBeInTheDocument();
  });

  it("edit keeps a stored registry prompt and surfaces an inaccessible reference explicitly", async () => {
    const user = userEvent.setup();
    const initial = createAgentConfig({
      name: "registry-agent",
      system_prompt: undefined,
      system_prompt_file: undefined,
    });
    const augmented = {
      ...initial,
      prompt_ref: { id: "prompt-deleted", version: 1 },
    } as unknown as typeof initial;

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={augmented}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    await ensureSectionOpen(user, [/prompt source/i]);
    // The raw id is never presented as a name; pinned semantics survive and
    // the orphan state is stated explicitly instead.
    const promptCombobox = screen.getByRole("combobox", { name: /^prompt$/i });
    expect(promptCombobox).not.toHaveTextContent("prompt-deleted");
    expect(
      within(screen.getByRole("radiogroup", { name: /version mode/i })).getByRole("radio", {
        name: /^pinned$/i,
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/not in your registry anymore/i)).toBeInTheDocument();
  });

  it("editing an agent carrying response enrichment fields saves without them (review I3)", async () => {
    const user = userEvent.setup();
    const initial = createAgentConfig({
      name: "enriched-agent",
      system_prompt: undefined,
      system_prompt_file: undefined,
    });
    const augmented = {
      ...initial,
      prompt_ref: { id: "prompt-registry-1", version: 2 },
      model_ref: "model-registry-1",
      prompt_name: "support-triage",
      catalog_model_name: "Fast Haiku",
      catalog_model_provider_model: "anthropic/claude-haiku-4.5",
    } as unknown as typeof initial;

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={augmented}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    // The response-only enrichment fields are stripped from the form
    // defaults, so the strict schema never refuses the save on unmapped
    // keys (zero-feedback no-op of review I3) and a registry conversion
    // stays on the critical path.
    expect(mockSubmit).toHaveBeenCalled();
    const payload = formPayload();
    expect(JSON.stringify(payload)).not.toContain("prompt_name");
    expect(JSON.stringify(payload)).not.toContain("catalog_model");
    expect(payload.model_ref).toBe("model-registry-1");
    expect(payload.prompt_ref).toEqual({ id: "prompt-registry-1", version: 2 });
  });

  it("editing a pinned registry agent keeps the pinned version selector", async () => {
    const user = userEvent.setup();
    const initial = createAgentConfig({
      name: "registry-agent",
      system_prompt: undefined,
      system_prompt_file: undefined,
    });
    const augmented = {
      ...initial,
      prompt_ref: { id: "prompt-registry-1", version: 2 },
    } as unknown as typeof initial;

    renderWithProviders(
      <AgentConfigForm
        mode="edit"
        initialData={augmented}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );

    await ensureSectionOpen(user, [/prompt source/i]);
    expect(
      within(screen.getByRole("radiogroup", { name: /version mode/i })).getByRole("radio", {
        name: /^pinned$/i,
      }),
    ).toHaveAttribute("aria-checked", "true");
    const versionCombobox = screen.getByRole("combobox", { name: /^version$/i });
    expect(versionCombobox).toBeInTheDocument();

    // Submitting keeps the pinned version without another interaction.
    await chooseOption(user, /^model$/i, "Fast Haiku");
    await user.click(screen.getByRole("button", { name: /^update$/i }));
    expect(formPayload().prompt_ref).toEqual({ id: "prompt-registry-1", version: 2 });
  });
});
