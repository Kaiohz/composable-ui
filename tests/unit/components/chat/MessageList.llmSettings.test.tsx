/**
 * Spec: feat-composable-mcp.md §REQ-041 / §REQ-052 (UI behavior)
 * When an agent (including the built-in assistant) cannot run because LLM
 * settings are missing, the existing chat error surface must show a clear
 * actionable message with a link/navigation action to `/settings`, without
 * silently creating credentials or hiding the failure, and without
 * displaying credential details.
 *
 * The chat error surface is MessageList's error block, fed by the real
 * useChatStore. The backend error text is the existing non-sensitive
 * LLM-not-configured message (composable-agents ErrorMessage.LLM_NOT_CONFIGURED).
 *
 * Step-1 (Red): the error surface renders the raw error only — there is no
 * actionable Settings link/navigation action today.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../../../utils/render";
import MessageList from "@/application/components/chat/MessageList";
import { useChatStore } from "@/application/stores/useChatStore";
import type { ThreadHistory } from "@/domain/entities/chat/traceEvent";
import { createThreadHistory } from "../../../fixtures/external";

const LLM_NOT_CONFIGURED_MESSAGE =
  "No LLM provider configured for user 11111111-1111-1111-1111-111111111111. Configure via PUT /api/v1/settings/llm.";

const SETTINGS_ROUTE_MARKER = "LLM Settings page reached";

const { historyState } = vi.hoisted(() => ({
  historyState: {
    data: undefined as ThreadHistory | undefined,
    isLoading: false,
  },
}));

vi.mock("@/application/hooks/chat/useThreadHistory", () => ({
  useThreadHistory: () => historyState,
}));

function renderChatError(redirectToSettings: boolean) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/chat/:threadId"
        element={<MessageList threadId="thread-123" agentName="composable-ai-assistant" />}
      />
      {redirectToSettings && (
        <Route path="/settings" element={<main>{SETTINGS_ROUTE_MARKER}</main>} />
      )}
    </Routes>,
    { initialEntries: ["/chat/thread-123"] },
  );
}

describe("MessageList — LLM-not-configured onboarding error", () => {
  beforeEach(() => {
    historyState.data = createThreadHistory();
    historyState.isLoading = false;
    useChatStore.setState({ error: null, isStreaming: false, pendingUserMessage: null });
  });

  afterEach(() => {
    useChatStore.setState({ error: null, isStreaming: false, pendingUserMessage: null });
  });

  it("still renders the raw non-sensitive error message in the chat error surface", () => {
    useChatStore.setState({ error: LLM_NOT_CONFIGURED_MESSAGE });

    renderChatError(true);

    expect(screen.getByText(/no llm provider configured/i)).toBeInTheDocument();
  });

  it("shows an actionable Settings action that navigates to /settings", async () => {
    useChatStore.setState({ error: LLM_NOT_CONFIGURED_MESSAGE });
    const user = userEvent.setup();

    renderChatError(true);

    const settingsAction = screen.getByRole("link", {
      name: /configure.*llm|llm.*settings|open.*settings|settings/i,
    });
    expect(settingsAction).toHaveAttribute("href", "/settings");

    await user.click(settingsAction);

    expect(screen.getByText(SETTINGS_ROUTE_MARKER)).toBeInTheDocument();
  });

  it("does not display credential details (no API-key material) in the error surface", () => {
    useChatStore.setState({ error: LLM_NOT_CONFIGURED_MESSAGE });

    renderChatError(true);

    expect(screen.queryByText(/api[_-]?key\s*[:=]/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sk-/i)).not.toBeInTheDocument();
  });

  it("does not inject a Settings action for unrelated chat errors", () => {
    useChatStore.setState({ error: "Stream failed: connection reset" });

    renderChatError(false);

    expect(screen.getByText(/stream failed/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });
});
