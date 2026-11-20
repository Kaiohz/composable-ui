/**
 * Spec: feat-composable-mcp.md §REQ-045 / §REQ-031 / §REQ-033 (UI behavior)
 * The Agents page must display `composable-ai-assistant` with a `built-in`
 * badge placed before custom agents, and a user with no custom agents must
 * see the built-in assistant (the backend overlay supplies `is_builtin`
 * additively on AgentConfigMetadata).
 *
 * Uses the existing AgentsPage test conventions: data hooks are mocked with
 * a hoisted mutable bag (repo pattern); page → grid → card chain is real.
 *
 * Step-1 (Red): no built-in badge, no built-in-first ordering, and the
 * empty-custom-agents case is unguarded today.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import AgentsPage from "@/application/pages/AgentsPage";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import { createAgentConfigMetadata, createAgentConfig } from "../../fixtures/external";

function builtinAgent(overrides: Partial<AgentConfigMetadata> = {}) {
  return {
    ...createAgentConfigMetadata({
      name: "composable-ai-assistant",
      model: "openai:anthropic/claude-haiku-4.5:nitro",
      description: "Built-in Composable AI Assistant",
      ...overrides,
    }),
    is_builtin: true,
  } as AgentConfigMetadata & { is_builtin: boolean };
}

function customAgent(overrides: Partial<AgentConfigMetadata> = {}) {
  return {
    ...createAgentConfigMetadata({
      name: "my-agent",
      model: "openai:gpt-4o",
      ...overrides,
    }),
    is_builtin: false,
  } as AgentConfigMetadata & { is_builtin: boolean };
}

const { mockAgentsData, mockAgentConfigData } = vi.hoisted(() => ({
  mockAgentsData: {
    data: undefined as unknown,
    isLoading: false,
    error: null as unknown,
  },
  mockAgentConfigData: {
    data: undefined as unknown,
    isLoading: false,
  },
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => mockAgentsData,
}));

vi.mock("@/application/hooks/agent/useCreateAgent", () => ({
  useCreateAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/agent/useAgentConfig", () => ({
  useAgentConfig: (_agentName: string | null) => mockAgentConfigData,
}));

vi.mock("@/application/hooks/agent/useDeleteAgent", () => ({
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/agent/useUpdateAgent", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function agentCard(name: string): HTMLElement {
  const heading = screen.getByText(name);
  expect(heading).not.toBeNull();
  const card = heading.closest('[data-od-id^="agent-card-"]');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe("AgentsPage — built-in Composable AI Assistant discovery", () => {
  beforeEach(() => {
    mockAgentsData.data = undefined;
    mockAgentsData.isLoading = false;
    mockAgentsData.error = null;
    mockAgentConfigData.data = undefined;
    mockAgentConfigData.isLoading = false;
  });

  it("shows the built-in badge on the composable-ai-assistant card", () => {
    mockAgentsData.data = [builtinAgent(), customAgent()];

    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    const builtinCard = agentCard("composable-ai-assistant");
    expect(within(builtinCard).getByText(/^built[- ]?in$/i)).toBeInTheDocument();
  });

  it("does not show a built-in badge on custom agents", () => {
    mockAgentsData.data = [builtinAgent(), customAgent()];

    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    const customCard = agentCard("my-agent");
    expect(within(customCard).queryByText(/^built[- ]?in$/i)).not.toBeInTheDocument();
  });

  it("places the built-in assistant before custom agents in the grid", () => {
    // The API returns custom agents first; the UI owns built-in-first
    // placement (spec §REQ-045 "place it before custom agents").
    mockAgentsData.data = [customAgent(), builtinAgent()];

    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    const builtinCard = agentCard("composable-ai-assistant");
    const customCard = agentCard("my-agent");
    // compareDocumentPosition(FOLLOWING): the custom card must come AFTER the
    // built-in card in the rendered grid, i.e. built-in first.
    expect(
      builtinCard.compareDocumentPosition(customCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the built-in assistant when the user has no custom agents", () => {
    mockAgentsData.data = [builtinAgent()];

    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    expect(agentCard("composable-ai-assistant")).toBeInTheDocument();
    expect(screen.queryByText(/failed to load agents/i)).not.toBeInTheDocument();
  });
});

describe("AgentsPage — built-in assistant selection opens the read-only viewer", () => {
  beforeEach(() => {
    mockAgentsData.data = [customAgent(), builtinAgent()];
    mockAgentConfigData.data = createAgentConfig({
      name: "composable-ai-assistant",
      system_prompt:
        "You are the Composable AI Assistant. You can manage Composable resources, use available MCP capabilities, and run other user agents.",
    });
    mockAgentConfigData.isLoading = false;
  });

  it("the built-in assistant card opens the configuration viewer showing the definition", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    await user.click(
      within(agentCard("composable-ai-assistant")).getByRole("button", { name: /configure/i }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("composable-ai-assistant")).toBeInTheDocument();
    expect(within(dialog).getByText(/Composable AI Assistant/i)).toBeInTheDocument();
  });

  it("hides or disables Edit for the built-in assistant", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    await user.click(
      within(agentCard("composable-ai-assistant")).getByRole("button", { name: /configure/i }),
    );
    await screen.findByRole("dialog");

    // The responsive footer renders the label twice (mobile/span variants),
    // so the accessible name may be a doubled "Edit Edit".
    const editButton = screen.queryByRole("button", { name: /^edit(\s+edit)?$/i });
    expect(editButton === null || editButton.hasAttribute("disabled")).toBe(true);
  });

  it("hides or disables Delete for the built-in assistant", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    await user.click(
      within(agentCard("composable-ai-assistant")).getByRole("button", { name: /configure/i }),
    );
    await screen.findByRole("dialog");

    const deleteButton = screen.queryByRole("button", { name: /^delete$/i });
    expect(deleteButton === null || deleteButton.hasAttribute("disabled")).toBe(true);
  });

  it("custom agents keep a working Edit and Delete in the viewer", async () => {
    mockAgentConfigData.data = createAgentConfig({ name: "my-agent" });
    const user = userEvent.setup();
    renderWithProviders(<AgentsPage />, { initialEntries: ["/agents"] });

    await user.click(within(agentCard("my-agent")).getByRole("button", { name: /configure/i }));
    await screen.findByRole("dialog");

    // Responsive labels may double the text ("Edit Edit" / "Delete Delete").
    const editButton = screen.getByRole("button", { name: /^edit(\s+edit)?$/i });
    const editDisabled = editButton.hasAttribute("disabled");
    const deleteButton = screen.getByRole("button", { name: /^delete(\s+delete)?$/i });
    const deleteDisabled = deleteButton.hasAttribute("disabled");
    expect(editDisabled && deleteDisabled).toBe(false);
    expect(editDisabled || deleteDisabled).toBe(false);
  });
});
