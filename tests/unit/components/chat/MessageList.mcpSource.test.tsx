/**
 * Spec: feat-composable-mcp.md §REQ-049 / §REQ-050 (required badge location 2)
 * The chat thread details/header must render the `MCP` source pill when the
 * opened thread originated from a one-shot MCP run, while CHAT and CRON
 * rendering remain unchanged. The trace-detail read-only view reuses this
 * same component, so this file covers badge location 4 as well.
 *
 * Uses the existing MessageList test conventions: the data hook is mocked
 * with a hoisted mutable bag (repo convention), the component is real.
 *
 * Step-1 (Red note): the shared ThreadSourceBadge is source-agnostic, so
 * these assertions pin the MCP contract in the chat header; the `"mcp"`
 * union extension itself is enforced at the type layer.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import MessageList from "@/application/components/chat/MessageList";
import type { ThreadHistory } from "@/domain/entities/chat/traceEvent";
import type { ThreadSource } from "@/domain/entities/chat/threadSource";
import { createThreadHistory, createTurn, createMessage } from "../../../fixtures/external";
import { MessageRole } from "@/domain/entities/chat/message";

const { historyState } = vi.hoisted(() => ({
  historyState: {
    data: undefined as ThreadHistory | undefined,
    isLoading: false,
  },
}));

vi.mock("@/application/hooks/chat/useThreadHistory", () => ({
  useThreadHistory: () => historyState,
}));

function threadHistory(source: ThreadSource): ThreadHistory {
  return createThreadHistory({
    thread: {
      id: "thread-mcp-123",
      agent_name: "runner-agent",
      created_at: "2026-11-19T10:00:00Z",
      updated_at: "2026-11-19T10:05:00Z",
      source,
    } as ThreadHistory["thread"],
    turns: [
      createTurn({
        human_message: createMessage({
          role: MessageRole.HUMAN,
          content: "Summarize my traces",
          status: null,
        }),
        ai_message: createMessage({ content: "Here is the summary" }),
        events: [],
      }),
    ],
  });
}

describe("MessageList — chat thread header MCP source badge", () => {
  beforeEach(() => {
    historyState.data = undefined;
    historyState.isLoading = false;
  });

  it("renders an MCP label on the thread header for an mcp thread", () => {
    historyState.data = threadHistory("mcp" as unknown as ThreadSource);

    renderWithProviders(<MessageList threadId="thread-mcp-123" agentName="runner-agent" />, {
      initialEntries: ["/chat/thread-mcp-123"],
    });

    expect(screen.getByLabelText("Thread source: mcp")).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("the MCP header pill carries the shared stable data-od-id", () => {
    historyState.data = threadHistory("mcp" as unknown as ThreadSource);

    renderWithProviders(<MessageList threadId="thread-mcp-123" agentName="runner-agent" />, {
      initialEntries: ["/chat/thread-mcp-123"],
    });

    expect(screen.getByLabelText("Thread source: mcp")).toHaveAttribute(
      "data-od-id",
      "thread-source-badge",
    );
  });

  it("existing CHAT rendering is unchanged alongside MCP", () => {
    historyState.data = threadHistory("chat");

    renderWithProviders(<MessageList threadId="thread-mcp-123" agentName="runner-agent" />, {
      initialEntries: ["/chat/thread-mcp-123"],
    });

    expect(screen.getByLabelText("Thread source: chat")).toBeInTheDocument();
    expect(screen.getByText("CHAT")).toBeInTheDocument();
    expect(screen.queryByText("MCP")).not.toBeInTheDocument();
  });
});
