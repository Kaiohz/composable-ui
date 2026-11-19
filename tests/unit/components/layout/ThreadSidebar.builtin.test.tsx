/**
 * Spec: feat-composable-mcp.md §REQ-045 / §REQ-031 / §REQ-047 / §REQ-048
 * (New Conversation agent chooser)
 *  - The chooser lists `composable-ai-assistant` with a `built-in` badge,
 *    placed before custom agents.
 *  - A user with no custom agents sees the built-in assistant instead of
 *    "No agents available".
 *  - Manual selection is preserved: New Conversation opens the chooser; no
 *    thread is created automatically and no agent is auto-selected.
 *
 * Uses the existing ThreadSidebar test conventions: data hooks are mocked
 * with a hoisted mutable bag (repo pattern); the sidebar is real.
 *
 * Step-1 (Red): no built-in badge, no built-in-first ordering, and the
 * "No agents available" empty state does not account for the built-in
 * assistant.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import ThreadSidebar from "@/application/components/layout/ThreadSidebar";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import { createAgentConfigMetadata } from "../../../fixtures/external";

function builtinAgent(overrides: Partial<AgentConfigMetadata> = {}) {
  return {
    ...createAgentConfigMetadata({
      name: "composable-ai-assistant",
      model: "openai:anthropic/claude-haiku-4.5:nitro",
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

const { mockThreadsData, mockAgentsData, mockCreateThreadMutate } = vi.hoisted(() => ({
  mockThreadsData: {
    data: undefined as
      | Array<{
          id: string;
          agent_name: string;
          created_at: string;
          updated_at: string;
        }>
      | undefined,
    isLoading: false,
  },
  mockAgentsData: {
    data: undefined as unknown,
    isLoading: false,
  },
  mockCreateThreadMutate: vi.fn(),
}));

vi.mock("@/application/hooks/chat/useThreads", () => ({
  useThreads: () => mockThreadsData,
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => mockAgentsData,
}));

vi.mock("@/application/hooks/chat/useCreateThread", () => ({
  useCreateThread: () => ({ mutate: mockCreateThreadMutate, isPending: false }),
}));

vi.mock("@/application/stores/useChatStore", () => ({
  useChatStore: (selector: (state: { setActiveThread: () => void }) => unknown) =>
    selector({ setActiveThread: () => {} }),
}));

async function openAgentChooser() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /new conversation/i }));
  expect(await screen.findByText("Choose an Agent")).toBeInTheDocument();
  return user;
}

describe("ThreadSidebar — New Conversation chooser built-in assistant", () => {
  beforeEach(() => {
    mockThreadsData.data = [];
    mockThreadsData.isLoading = false;
    mockAgentsData.data = undefined;
    mockAgentsData.isLoading = false;
    mockCreateThreadMutate.mockClear();
  });

  it("shows a built-in badge for composable-ai-assistant in the chooser", async () => {
    mockAgentsData.data = [customAgent(), builtinAgent()];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });
    await openAgentChooser();

    expect(screen.getByText(/^built[- ]?in$/i)).toBeInTheDocument();
  });

  it("places the built-in assistant before custom agents in the chooser", async () => {
    // Backend returns custom agents first; the UI owns built-in-first
    // placement (spec §REQ-045).
    mockAgentsData.data = [customAgent(), builtinAgent()];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });
    await openAgentChooser();

    const builtinEntry = screen.getByText("composable-ai-assistant");
    const customEntry = screen.getByText("my-agent");
    // compareDocumentPosition(FOLLOWING): the custom chooser entry must come
    // AFTER the built-in entry, i.e. built-in first.
    expect(
      builtinEntry.compareDocumentPosition(customEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("a user with no custom agents sees the built-in assistant instead of 'No agents available'", async () => {
    mockAgentsData.data = [builtinAgent()];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });
    await openAgentChooser();

    expect(screen.getByText("composable-ai-assistant")).toBeInTheDocument();
    expect(screen.queryByText(/no agents available/i)).not.toBeInTheDocument();
  });

  it("does not create a thread automatically when the chooser opens", async () => {
    mockAgentsData.data = [customAgent(), builtinAgent()];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });
    await openAgentChooser();

    expect(mockCreateThreadMutate).not.toHaveBeenCalled();
  });

  it("selecting the built-in assistant creates a chat thread through the existing createThread flow", async () => {
    mockAgentsData.data = [customAgent(), builtinAgent()];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });
    const user = await openAgentChooser();

    await user.click(screen.getByText("composable-ai-assistant"));

    expect(mockCreateThreadMutate).toHaveBeenCalledOnce();
    expect(mockCreateThreadMutate).toHaveBeenCalledWith(
      "composable-ai-assistant",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("New Conversation keeps opening the chooser instead of auto-selecting the assistant", () => {
    mockAgentsData.data = [builtinAgent()];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });
    expect(screen.queryByText("Choose an Agent")).not.toBeInTheDocument();
    expect(mockCreateThreadMutate).not.toHaveBeenCalled();
  });
});
