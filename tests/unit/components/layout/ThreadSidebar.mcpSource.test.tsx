/**
 * Spec: feat-composable-mcp.md §REQ-049 / §REQ-050 (required badge location 1)
 * ThreadSidebar must render an `MCP` source pill (accessible label
 * "Thread source: mcp") on MCP-originated thread rows, while the existing
 * CHAT and CRON rendering remains unchanged. The frontend ThreadSource
 * union must admit the new `"mcp"` source.
 *
 * Uses the existing ThreadSidebar test conventions: data hooks are mocked
 * with a hoisted mutable bag (repo pattern), the sidebar component is real.
 *
 * Note on Red status: the shared ThreadSourceBadge is source-agnostic, so
 * the `mcp` union extension itself is the compile-time part of this gate;
 * the runtime assertions below pin the badge contract in the sidebar and
 * guard the unchanged CHAT/CRON behavior.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, expectTypeOf } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import ThreadSidebar from "@/application/components/layout/ThreadSidebar";
import type { ThreadSource } from "@/domain/entities/chat/threadSource";

const { mockThreadsData, mockAgentsData } = vi.hoisted(() => ({
  mockThreadsData: {
    data: undefined as
      | Array<
          { id: string; agent_name: string; created_at: string; updated_at: string } & {
            source?: ThreadSource;
          }
        >
      | undefined,
    isLoading: false,
  },
  mockAgentsData: {
    data: [] as unknown[],
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

function threadFixture(id: string, agent: string, source: string) {
  return {
    id,
    agent_name: agent,
    created_at: "2026-11-19T10:00:00Z",
    updated_at: "2026-11-19T10:05:00Z",
    source: source as unknown as ThreadSource,
  };
}

describe("ThreadSidebar — MCP thread source badge", () => {
  beforeEach(() => {
    mockThreadsData.data = undefined;
    mockThreadsData.isLoading = false;
    mockAgentsData.data = [];
    mockAgentsData.isLoading = false;
  });

  it("renders an MCP pill on mcp-originated thread rows", () => {
    mockThreadsData.data = [threadFixture("thread-mcp", "runner-agent", "mcp")];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    expect(screen.getByLabelText("Thread source: mcp")).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("renders one pill per thread, matching each thread's own origin (chat, cron, mcp)", () => {
    mockThreadsData.data = [
      threadFixture("thread-chat", "helper-agent", "chat"),
      threadFixture("thread-cron", "digest-agent", "cron"),
      threadFixture("thread-mcp", "runner-agent", "mcp"),
    ];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    expect(screen.getByLabelText("Thread source: chat")).toBeInTheDocument();
    expect(screen.getByLabelText("Thread source: cron")).toBeInTheDocument();
    expect(screen.getByLabelText("Thread source: mcp")).toBeInTheDocument();
    expect(screen.getByText("CHAT")).toBeInTheDocument();
    expect(screen.getByText("CRON")).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("the MCP pill is noninteractive like the existing pills", () => {
    mockThreadsData.data = [threadFixture("thread-mcp", "runner-agent", "mcp")];

    renderWithProviders(<ThreadSidebar />, { initialEntries: ["/chat"] });

    const pill = screen.getByLabelText("Thread source: mcp");
    expect(pill.tagName).not.toBe("BUTTON");
    expect(pill.getAttribute("data-od-id")).toBe("thread-source-badge");
    expect(pill.closest("button")).not.toBeNull();
  });

  it("ThreadSource admits the mcp value (type-level witness)", () => {
    // Compile-time gate: while the union is still "chat" | "cron", asserting
    // the required extended union below is a type error. Vitest strips types
    // at runtime, so this witness is enforced by the editor/typecheck step.
    const candidate = null as unknown;
    expectTypeOf(candidate as "chat" | "cron" | "mcp").toEqualTypeOf<ThreadSource>();
  });
});
