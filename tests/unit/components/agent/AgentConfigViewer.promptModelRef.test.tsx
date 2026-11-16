/**
 * Spec: prompts-models-crons-traces.md §AGT-004.10 (agent read-only view)
 * AgentConfigViewer's read-only configuration displays:
 *  - prompt name plus `Latest` or `vN` when prompt_ref is configured;
 *  - catalog model name + provider model identifier when model_ref is set;
 *  - legacy system_prompt / custom model values unchanged otherwise.
 *
 * Step-1 (Red): the viewer displays none of the reference metadata yet.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import AgentConfigViewer from "@/application/components/agent/AgentConfigViewer";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import type { ModelConfiguration, PromptMetadata } from "../../../fixtures/registries";
import { createPromptMetadata, createModelConfiguration } from "../../../fixtures/registries";
import { createAgentConfig } from "../../../fixtures/external";

const historyState = vi.hoisted(() => ({
  agentConfig: undefined as unknown,
  agentName: null as string | null,
}));

const { registryPromptsState, registryModelsState } = vi.hoisted(() => ({
  registryPromptsState: {
    data: undefined as PromptMetadata[] | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  registryModelsState: {
    data: undefined as ModelConfiguration[] | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/application/hooks/agent/useAgentConfig", () => ({
  useAgentConfig: (name: string | null) => {
    historyState.agentName = name;
    return {
      data: historyState.agentConfig as AgentConfig | undefined,
      isLoading: false,
      error: null,
    };
  },
}));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => registryPromptsState,
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => registryModelsState,
}));

vi.mock("@/application/hooks/agent/useUpdateAgent", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/agent/useDeleteAgent", () => ({
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/store/useStoreFiles", () => ({
  useStoreFiles: () => ({ data: [], isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function augment(base: AgentConfig, extra: object): AgentConfig {
  return { ...base, ...extra } as unknown as AgentConfig;
}

describe("AgentConfigViewer — prompt/model reference display", () => {
  beforeEach(() => {
    historyState.agentConfig = undefined;
    historyState.agentName = null;
    registryPromptsState.data = undefined;
    registryPromptsState.isLoading = false;
    registryPromptsState.isError = false;
    registryPromptsState.refetch.mockReset();
    registryModelsState.data = undefined;
    registryModelsState.isLoading = false;
    registryModelsState.isError = false;
    registryModelsState.refetch.mockReset();
  });

  it("displays the prompt name plus Latest for an unpinned prompt_ref", () => {
    historyState.agentConfig = augment(createAgentConfig({ model: "legacy-model-string" }), {
      prompt_ref: { id: "prompt-registry-1", version: undefined },
      prompt_name: "support-triage",
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/support-triage/i)).toBeInTheDocument();
    expect(screen.getByText(/latest/i)).toBeInTheDocument();
  });

  it("displays the pinned version (vN) for a pinned prompt_ref", () => {
    historyState.agentConfig = augment(createAgentConfig(), {
      prompt_ref: { id: "prompt-registry-1", version: 3 },
      prompt_name: "support-triage",
      model_ref: "model-registry-1",
      catalog_model_name: "Fast Haiku",
      catalog_model_provider_model: "anthropic/claude-haiku-4.5",
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/v3/i)).toBeInTheDocument();
    expect(screen.queryByText(/latest/i)).not.toBeInTheDocument();
  });

  it("displays the catalog model name and provider model identifier", () => {
    historyState.agentConfig = augment(createAgentConfig(), {
      model_ref: "model-registry-1",
      catalog_model_name: "Fast Haiku",
      catalog_model_provider_model: "anthropic/claude-haiku-4.5",
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/fast haiku/i)).toBeInTheDocument();
    expect(screen.getByText(/anthropic\/claude-haiku-4\.5/)).toBeInTheDocument();
  });

  it("legacy agents keep displaying system prompt and custom model string", () => {
    historyState.agentConfig = createAgentConfig({
      model: "openai:anthropic/claude-haiku-4.5:nitro",
      system_prompt: "You are inline.",
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/openai:anthropic\/claude-haiku-4\.5:nitro/)).toBeInTheDocument();
    expect(screen.getByText(/you are inline\./i)).toBeInTheDocument();
  });

  it("resolves prompt and catalog model names client-side from the user's registries", () => {
    // Real backend payloads carry ids only — no prompt_name/catalog_model_*
    // enrichment. The viewer resolves the display names from the registries
    // (C4).
    registryPromptsState.data = [
      createPromptMetadata({ id: "prompt-registry-1", name: "support-triage" }),
    ];
    registryModelsState.data = [
      createModelConfiguration({
        id: "model-registry-1",
        name: "Fast Haiku",
        provider_model: "anthropic/claude-haiku-4.5",
      }),
    ];
    historyState.agentConfig = augment(createAgentConfig({ system_prompt: undefined }), {
      prompt_ref: { id: "prompt-registry-1", version: 2 },
      model_ref: "model-registry-1",
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/support-triage/i)).toBeInTheDocument();
    expect(screen.getByText(/v2/i)).toBeInTheDocument();
    expect(screen.getByText(/fast haiku/i)).toBeInTheDocument();
    expect(screen.getByText(/anthropic\/claude-haiku-4\.5/)).toBeInTheDocument();
  });

  it("shows an explicit unavailable label — never a raw UUID — for a reference outside the registry", () => {
    registryPromptsState.data = [];
    registryModelsState.data = [];
    historyState.agentConfig = augment(createAgentConfig({ system_prompt: undefined }), {
      prompt_ref: { id: "7e6a56fd-83e7-46a1-a2f2-f5c5f8d9a52e", version: 1 },
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/not in your registry anymore/i)).toBeInTheDocument();
    // The raw UUID is never presented as if it were a name (C4).
    expect(screen.queryByText(/7e6a56fd/i)).not.toBeInTheDocument();
  });

  it("reports a FAILED registry request as unavailable-plus-retry, not as a missing reference (BUG-002)", async () => {
    // Registry requests fail — the references themselves are valid.
    registryPromptsState.isError = true;
    registryModelsState.isError = true;
    historyState.agentConfig = augment(createAgentConfig({ system_prompt: undefined }), {
      prompt_ref: { id: "prompt-registry-1", version: 1 },
      model_ref: "model-registry-1",
    });

    renderWithProviders(
      <AgentConfigViewer agentName="helper-agent" open onOpenChange={() => {}} />,
    );

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBe(2);
    for (const alert of alerts) {
      expect(alert).toHaveTextContent(/registry unavailable/i);
      expect(alert).toHaveTextContent(/could not be verified/i);
    }
    // Never claim the reference has been deleted.
    expect(screen.queryByText(/not in your registry anymore/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      within(
        document.querySelector('[data-od-id="agent-model-registry-unavailable"]') as HTMLElement,
      ).getByRole("button", { name: /retry/i }),
    );
    expect(registryModelsState.refetch).toHaveBeenCalled();
    await user.click(
      within(
        document.querySelector('[data-od-id="agent-prompt-registry-unavailable"]') as HTMLElement,
      ).getByRole("button", { name: /retry/i }),
    );
    expect(registryPromptsState.refetch).toHaveBeenCalled();
  });
});
