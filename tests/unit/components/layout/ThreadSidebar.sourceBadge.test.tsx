/**
 * Spec: prompts-models-crons-traces.md §SRC-003 (required badge location 1)
 * Every thread in the ThreadSidebar must render the CHAT/CRON source pill.
 *
 * Uses the existing ThreadSidebar test conventions: data hooks are mocked
 * with a hoisted mutable bag (repo pattern), the sidebar component is real.
 *
 * Step-1 (Red): ThreadSidebar has no ThreadSourceBadge yet.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import ThreadSidebar from "@/application/components/layout/ThreadSidebar";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import type { Thread } from "@/domain/entities/chat/thread";

const { mockThreadsData, mockAgentsData } = vi.hoisted(() => ({
  mockThreadsData: {
    data: undefined as Array<Thread & { source?: "chat" | "cron" }> | undefined,
    isLoading: false,
  },
  mockAgentsData: {
    data: undefined as AgentConfigMetadata[] | undefined,
    isLoading: false,
  },
}));

vi.mock("@/application/hooks/chat/useThreads", () => ({
  useThreads: () => mockThreadsData,
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => mockAgentsData,
}));

vi.mock("@/application/hooks/chat/useCreateThread", () => ({
  useCreateThread: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/stores/useChatStore", () => ({
  useChatStore: (selector: (state: { setActiveThread: () => void }) => unknown) =>
    selector({ setActiveThread: () => {} }),
}));

describe("ThreadSidebar — thread source badges", () => {
  beforeEach(() => {
    mockThreadsData.data = undefined;
    mockThreadsData.isLoading = false;
    mockAgentsData.data = [];
    mockAgentsData.isLoading = false;
  });

  it("renders a CHAT pill on chat-originated thread rows", () => {
    mockThreadsData.data = [
      {
        id: "thread-chat",
        agent_name: "helper-agent",
        messages: [],
        created_at: "2026-11-15T10:00:00Z",
        updated_at: "2026-11-15T10:05:00Z",
        source: "chat",
      },
    ];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    expect(screen.getByLabelText(/thread source: chat/i)).toBeInTheDocument();
    expect(screen.getByText("CHAT")).toBeInTheDocument();
  });

  it("renders a CRON pill on cron-originated thread rows", () => {
    mockThreadsData.data = [
      {
        id: "thread-cron",
        agent_name: "digest-agent",
        messages: [],
        created_at: "2026-11-15T09:00:00Z",
        updated_at: "2026-11-15T09:01:10Z",
        source: "cron",
      },
    ];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
    expect(screen.getByText("CRON")).toBeInTheDocument();
  });

  it("renders one pill per thread, matching each thread's own origin", () => {
    mockThreadsData.data = [
      {
        id: "thread-chat",
        agent_name: "helper-agent",
        messages: [],
        created_at: "2026-11-15T10:00:00Z",
        updated_at: "2026-11-15T10:05:00Z",
        source: "chat",
      },
      {
        id: "thread-cron",
        agent_name: "digest-agent",
        messages: [],
        created_at: "2026-11-15T09:00:00Z",
        updated_at: "2026-11-15T09:01:10Z",
        source: "cron",
      },
    ];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    expect(screen.getByLabelText(/thread source: chat/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
    expect(screen.getByText("CHAT")).toBeInTheDocument();
    expect(screen.getByText("CRON")).toBeInTheDocument();
  });

  it("the sidebar pills are noninteractive (no button role on the pill)", () => {
    mockThreadsData.data = [
      {
        id: "thread-cron",
        agent_name: "digest-agent",
        messages: [],
        created_at: "2026-11-15T09:00:00Z",
        updated_at: "2026-11-15T09:01:10Z",
        source: "cron",
      },
    ];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    const pill = screen.getByLabelText(/thread source: cron/i);
    expect(pill.tagName).not.toBe("BUTTON");
    // The row itself remains the interactive element that navigates.
    expect(pill.closest("button")).not.toBeNull();
  });
});
