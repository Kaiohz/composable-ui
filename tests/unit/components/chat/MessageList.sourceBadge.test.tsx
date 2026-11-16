/**
 * Spec: prompts-models-crons-traces.md §SRC-003 (required badge location 2)
 * Chat thread details/header must render the CHAT/CRON source pill. The
 * thread payload of the existing history endpoint includes `source`.
 *
 * MessageList is the chat thread presentation component; the test mocks only
 * its data hook (repo convention) and asserts the visible pill.
 *
 * Step-1 (Red): the source pill is not rendered in the thread header yet.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import MessageList from "@/application/components/chat/MessageList";
import type { ThreadHistory } from "@/domain/entities/chat/traceEvent";
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

function chatThreadHistory(source: "chat" | "cron"): ThreadHistory {
  const history = createThreadHistory({
    thread: {
      id: "thread-123",
      agent_name: "helper-agent",
      messages: [],
      created_at: "2026-11-15T10:00:00Z",
      updated_at: "2026-11-15T10:05:00Z",
      source,
    } as ThreadHistory["thread"],
    turns: [
      createTurn({
        human_message: createMessage({
          role: MessageRole.HUMAN,
          content: "Morning brief",
          status: null,
        }),
        ai_message: createMessage({ content: "Here it is" }),
        events: [],
      }),
    ],
  });
  return history;
}

describe("MessageList — chat thread details source badge", () => {
  beforeEach(() => {
    historyState.data = undefined;
    historyState.isLoading = false;
  });

  it("renders a CHAT label on the thread header for a chat thread", () => {
    historyState.data = chatThreadHistory("chat");

    renderWithProviders(<MessageList threadId="thread-123" agentName="helper-agent" />, {
      initialEntries: ["/chat/thread-123"],
    });

    expect(screen.getByLabelText(/thread source: chat/i)).toBeInTheDocument();
    expect(screen.getByText("CHAT")).toBeInTheDocument();
  });

  it("renders a CRON label on the thread header when a cron thread is opened through chat", () => {
    historyState.data = chatThreadHistory("cron");

    renderWithProviders(<MessageList threadId="thread-123" agentName="helper-agent" />, {
      initialEntries: ["/chat/thread-123"],
    });

    expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
    expect(screen.getByText("CRON")).toBeInTheDocument();
  });
});
