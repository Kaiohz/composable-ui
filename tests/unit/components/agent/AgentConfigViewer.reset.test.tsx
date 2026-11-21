import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import AgentConfigViewer from "@/application/components/agent/AgentConfigViewer";
import { createAgentConfig } from "../../../fixtures/external";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";

const { mockAgentConfigData, resetBuiltinCustomization, toastError } = vi.hoisted(() => ({
  mockAgentConfigData: {
    data: undefined as AgentConfig | undefined,
    isLoading: false,
  },
  resetBuiltinCustomization: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/application/hooks/agent/useAgentConfig", () => ({
  useAgentConfig: (_agentName: string | null) => mockAgentConfigData,
}));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@/infrastructure/api/agent/agentApi", () => ({
  agentApi: {
    resetBuiltinCustomization,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: toastError,
  },
}));

describe("AgentConfigViewer — built-in reset data flow", () => {
  beforeEach(() => {
    mockAgentConfigData.data = undefined;
    resetBuiltinCustomization.mockReset();
    resetBuiltinCustomization.mockResolvedValue(undefined);
  });

  it("resets the built-in customization through the real reset hook and API adapter", async () => {
    mockAgentConfigData.data = createAgentConfig({
      name: "composable-ai-assistant",
      is_customized: true,
    });
    const user = userEvent.setup();

    renderWithProviders(
      <AgentConfigViewer agentName="composable-ai-assistant" open onOpenChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /reset to default/i }));
    await user.click(screen.getByRole("button", { name: /confirm reset/i }));

    await waitFor(() => {
      expect(resetBuiltinCustomization).toHaveBeenCalledWith("composable-ai-assistant");
    });
  });

  it("surfaces a reset failure through the existing toast error path", async () => {
    resetBuiltinCustomization.mockRejectedValue(new Error("Reset failed"));
    mockAgentConfigData.data = createAgentConfig({
      name: "composable-ai-assistant",
      is_customized: true,
    });
    const user = userEvent.setup();

    renderWithProviders(
      <AgentConfigViewer agentName="composable-ai-assistant" open onOpenChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /reset to default/i }));
    await user.click(screen.getByRole("button", { name: /confirm reset/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Reset failed");
    });
  });
});
