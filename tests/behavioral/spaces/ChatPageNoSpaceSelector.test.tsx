/**
 * Spec: scope-rag-memories-user-agent.md — REQ-023 (chat page regression
 * guard).
 *
 * Behavioral entry point: the REAL ChatPage (real header ThreadTabs + real hooks:
 * useThreads, useAgents, useCreateThread) under the real router route shape
 * (`/chat/:threadId?`); the network boundary is scripted (repo convention —
 * MSW is not installed in this repo).
 *
 * Contract under test (REQ-023):
 * - the chat page must NOT render the space selector (no space notion on the
 *   chat page — the agent scope is resolved server-side);
 * - the chat page must not even fetch the spaces list;
 * - the existing agent chooser in the header thread tabs stays as-is (agent
 *   dialog, builtin-first ordering, builtin badge, thread creation).
 *
 * NOTE: absence assertions are also expected to pass in the RED phase (nothing
 * exists yet) — REQ-023 requires the chat page to remain UNCHANGED, so this
 * suite guards the invariant across the implementation.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import ChatPage from "@/application/pages/ChatPage";
import { renderWithProviders } from "../../utils/render";
import {
  jsonBody,
  restoreAllNetworks,
  route,
  stubNetwork,
  type CapturedRequest,
  type StubbedNetwork,
} from "../../utils/network";
import { spacesRoutes } from "../../fixtures/spaces";

function stubChatNetwork(): StubbedNetwork {
  return stubNetwork([
    ...spacesRoutes(), // exists for the other pages — the chat page must not use it
    route("api", "GET", /\/api\/v1\/threads$/, () => ({ status: 200, data: [] })),
    route("api", "POST", /\/api\/v1\/threads$/, () => ({
      status: 200,
      data: {
        id: "thread-new",
        agent_name: "agent-zeta",
        messages: [],
        created_at: "2026-11-01T08:00:00Z",
        updated_at: "2026-11-01T08:00:00Z",
        source: null,
      },
    })),
  ]);
}

function latest(net: StubbedNetwork, method: string, match: RegExp): CapturedRequest | undefined {
  const found = net.requests.filter((req) => req.method === method && match.test(req.path));
  return found.length > 0 ? found[found.length - 1] : undefined;
}

afterEach(() => {
  restoreAllNetworks();
});

function renderChat() {
  return renderWithProviders(
    <Routes>
      <Route path="/chat" element={<ChatPage />} />
    </Routes>,
    { initialEntries: ["/chat"] },
  );
}

describe("ChatPage keeps no space notion and its agent chooser (REQ-023)", () => {
  it("does not render a SpaceSelector on the chat page", async () => {
    stubChatNetwork();
    renderChat();

    expect(
      document.querySelector('[data-od-id="space-selector"]'),
      "the chat page must not gain a space selector",
    ).toBeNull();
    expect(screen.getByRole("heading", { name: /orchestration console/i })).toBeInTheDocument();
    await screen.findByText("No conversations yet");
  });

  it("never fetches GET /api/v1/spaces from the chat page", async () => {
    const net = stubChatNetwork();
    renderChat();

    // The sidebar has settled (threads list resolved).
    await screen.findByText("No conversations yet");

    expect(
      net.requests.find((req) => /\/api\/v1\/spaces$/.test(req.path)),
      "the chat page must not fetch the spaces list",
    ).toBeUndefined();
  });

  it("keeps the header agent chooser exactly as-is (builtin-first dialog + thread creation)", async () => {
    const net = stubChatNetwork();
    const user = userEvent.setup();
    renderChat();

    await user.click(
      await screen.findByRole("button", { name: "New conversation" }, {}, { timeout: 2000 }),
    );
    const dialog = await screen.findByRole("dialog", {}, { timeout: 2000 });

    // The chooser lists the platform catalog builtin-first.
    const dialogText = dialog.textContent ?? "";
    expect(dialogText).toContain("composable-ai-assistant");
    expect(dialogText).toContain("agent-zeta");
    expect(
      dialogText.indexOf("composable-ai-assistant"),
      "builtin assistant stays listed first in the chooser",
    ).toBeLessThan(dialogText.indexOf("agent-zeta"));
    expect(
      dialog.querySelector('[data-od-id="agent-chooser-builtin-badge"]'),
      "the builtin badge stays on the builtin assistant entry",
    ).not.toBeNull();

    await user.click(within(dialog).getAllByRole("button", { name: /agent-zeta/ })[0]);

    await waitFor(
      () => {
        const createRequest = latest(net, "POST", /\/api\/v1\/threads$/);
        expect(createRequest, "creating a thread from the chooser still works").toBeDefined();
        expect(jsonBody(createRequest as CapturedRequest).agent_name).toBe("agent-zeta");
      },
      { timeout: 2000 },
    );
  });
});
