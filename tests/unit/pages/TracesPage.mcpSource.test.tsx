/**
 * Spec: feat-composable-mcp.md §REQ-049 / §REQ-050 (badge locations 3 and 4)
 * The trace list rows and the trace detail header must render the `MCP`
 * source pill for MCP-originated executions, while CHAT and CRON rows keep
 * their existing rendering.
 *
 * Uses the existing TracesPage test conventions: the useTraces infinite
 * query and the thread-history hook are mocked with hoisted bags; the page
 * is real. Note: `/traces` defaults to the Dashboard tab — list tests open
 * the Threads sub-tab first (repo convention).
 *
 * Step-1 (Red note): the shared ThreadSourceBadge is source-agnostic, so
 * these assertions pin the MCP contract in traces; the `"mcp"` union
 * extension itself is enforced at the type layer.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../../utils/render";
import TracesPage from "@/application/pages/TracesPage";
import type { ThreadHistory } from "@/domain/entities/chat/traceEvent";
import type { ThreadSource } from "@/domain/entities/chat/threadSource";
import { createTraceSummary } from "../../fixtures/registries";
import { createThreadHistory, createTurn, createMessage } from "../../fixtures/external";
import { MessageRole } from "@/domain/entities/chat/message";

const { tracesState, threadHistoryState } = vi.hoisted(() => ({
  tracesState: {
    pages: [] as Array<{ items: unknown[]; next_cursor: string | null }>,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  },
  threadHistoryState: {
    data: undefined as ThreadHistory | undefined,
    isLoading: false,
  },
}));

vi.mock("@/application/hooks/trace/useTraces", () => ({
  useTraces: () => ({
    ...tracesState,
    data: {
      pages: tracesState.pages,
      pageParams: tracesState.pages.map((_, i) => (i ? `cursor-${i}` : undefined)),
    },
  }),
}));

vi.mock("@/application/hooks/chat/useThreadHistory", () => ({
  useThreadHistory: () => threadHistoryState,
}));

function mcpTraceSummary() {
  return createTraceSummary({
    thread_id: "thread-mcp-123",
    agent_name: "runner-agent",
    source: "mcp" as unknown as ThreadSource,
    started_at: "2026-11-19T10:00:00Z",
    last_event_at: "2026-11-19T10:04:00Z",
    event_count: 9,
    turn_count: 1,
  });
}

function mcpThreadHistory(): ThreadHistory {
  return createThreadHistory({
    thread: {
      id: "thread-mcp-123",
      agent_name: "runner-agent",
      created_at: "2026-11-19T10:00:00Z",
      updated_at: "2026-11-19T10:04:00Z",
      source: "mcp" as unknown as ThreadSource,
    } as ThreadHistory["thread"],
    turns: [
      createTurn({
        human_message: createMessage({
          role: MessageRole.HUMAN,
          content: "One-shot task",
          status: null,
        }),
        ai_message: createMessage({ content: "Done" }),
        events: [],
      }),
    ],
  });
}

function mcpTracePage() {
  return { items: [mcpTraceSummary()], next_cursor: null };
}

function renderTracesAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/traces/:threadId?" element={<TracesPage />} />
    </Routes>,
    { initialEntries: [path] },
  );
}

describe("TracesPage — MCP trace list badges", () => {
  beforeEach(() => {
    tracesState.pages = [];
    tracesState.isLoading = false;
    tracesState.isError = false;
    tracesState.error = undefined;
    tracesState.hasNextPage = false;
    tracesState.refetch.mockReset();
    tracesState.fetchNextPage.mockReset();
    threadHistoryState.data = undefined;
    threadHistoryState.isLoading = false;
  });

  it("renders an MCP pill on an mcp-originated trace row", async () => {
    tracesState.pages = [mcpTracePage()];
    const user = userEvent.setup();

    renderTracesAt("/traces");
    await user.click(screen.getByRole("tab", { name: /threads/i }));

    expect(screen.getByLabelText("Thread source: mcp")).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
    expect(screen.getByText("runner-agent")).toBeInTheDocument();
  });

  it("keeps rendering CHAT and CRON pills on non-MCP trace rows", async () => {
    tracesState.pages = [
      {
        items: [
          createTraceSummary({ thread_id: "thread-chat", agent_name: "helper-agent" }),
          createTraceSummary({
            thread_id: "thread-cron",
            agent_name: "digest-agent",
            source: "cron",
          }),
          mcpTraceSummary(),
        ],
        next_cursor: null,
      },
    ];
    const user = userEvent.setup();

    renderTracesAt("/traces");
    await user.click(screen.getByRole("tab", { name: /threads/i }));

    expect(screen.getByLabelText("Thread source: chat")).toBeInTheDocument();
    expect(screen.getByLabelText("Thread source: cron")).toBeInTheDocument();
    expect(screen.getByLabelText("Thread source: mcp")).toBeInTheDocument();
  });
});

describe("TracesPage — MCP trace detail header badge", () => {
  beforeEach(() => {
    tracesState.pages = [];
    tracesState.isLoading = false;
    threadHistoryState.data = undefined;
    threadHistoryState.isLoading = false;
  });

  it("renders the MCP pill in the read-only trace detail header", () => {
    threadHistoryState.data = mcpThreadHistory();
    threadHistoryState.isLoading = false;

    renderTracesAt("/traces/thread-mcp-123");

    expect(screen.getByLabelText("Thread source: mcp")).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });
});
