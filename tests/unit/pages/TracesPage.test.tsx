/**
 * Spec: prompts-models-crons-traces.md §TRC-001..TRC-004 (Trace UX)
 * Page contract (/traces/:threadId?):
 *  - List rows: agent, CHAT/CRON source pill, thread ID, started, last
 *    event, event count, turn count.
 *  - Exact agent-name filter (debounced); changing the filter resets to
 *    page one.
 *  - Cursor pagination via useInfiniteQuery: "Load more" APPENDS pages and
 *    is surfaced only while a next_cursor exists.
 *  - Distinct no-results (filter) vs empty (no threads) vs error+retry,
 *    and error must not be shown for a filtered empty result.
 *  - Read-only detail: source pill + existing thread timeline; NO composer,
 *    retry, resume, edit or invoke controls; explicit error/not-found state.
 *
 * Hook contract (repo page-test convention):
 *  - @/application/hooks/trace/useTraces → infinite query keyed by the
 *    exact agent filter ({ agentName?: string, limit?: number }); cursor
 *    pagination is handled inside the hook.
 *  - Trace detail reuses the existing @/application/hooks/chat/useThreadHistory.
 */
import { screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../../utils/render";
import TracesPage from "@/application/pages/TracesPage";
import type { Thread } from "@/domain/entities/chat/thread";
import { createTracePage, createTraceSummary } from "../../fixtures/registries";
import { createThreadHistory, createTurn, createMessage } from "../../fixtures/external";
import { MessageRole } from "@/domain/entities/chat/message";

const cronThread: Thread = {
  id: "55555555-5555-4555-8555-555555555555",
  agent_name: "digest-agent",
  created_at: "2026-11-15T12:00:00Z",
  updated_at: "2026-11-15T12:05:00Z",
  // Step-2 note: the thread payload gains the immutable `source` field.
  source: "cron",
} as unknown as Thread;

const { tracesState, threadHistoryState } = vi.hoisted(() => ({
  tracesState: {
    agentName: undefined as string | undefined,
    pages: [] as Array<{
      items: Array<ReturnType<typeof createTraceSummary>>;
      next_cursor: string | null;
    }>,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  },
  threadHistoryState: {
    data: undefined as ReturnType<typeof createThreadHistory> | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("@/application/hooks/trace/useTraces", () => ({
  useTraces: (
    params: {
      agentName?: string;
      limit?: number;
    } = {},
  ) => {
    tracesState.agentName = params.agentName;
    // The hook returns the accumulated pages (useInfiniteQuery shape).
    return {
      ...tracesState,
      data: {
        pages: tracesState.pages,
        pageParams: tracesState.pages.map((_, i) => (i ? `cursor-${i}` : undefined)),
      },
    };
  },
}));

vi.mock("@/application/hooks/chat/useThreadHistory", () => ({
  useThreadHistory: () => threadHistoryState,
}));

function renderTracesAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/traces/:threadId?" element={<TracesPage />} />
    </Routes>,
    { initialEntries: [path] },
  );
}

/**
 * Step-LLM-usage note: `/traces` now defaults to the Dashboard tab (spec:
 * LLM Usage Dashboard §8/§15). The existing per-thread history moved into
 * the Threads sub-tab; every list test below opens it first. All list
 * behaviour assertions are unchanged.
 */
async function renderThreadsListAt(path: string) {
  const view = renderTracesAt(path);
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: /threads/i }));
  return view;
}

describe("TracesPage — list", () => {
  beforeEach(() => {
    tracesState.refetch.mockReset();
    tracesState.fetchNextPage.mockReset();
    tracesState.pages = [];
    tracesState.isLoading = false;
    tracesState.isError = false;
    tracesState.error = undefined;
    tracesState.agentName = undefined;
    tracesState.hasNextPage = false;
    threadHistoryState.data = undefined;
    threadHistoryState.isLoading = false;
  });

  it("renders trace rows with agent, source pill, thread id, counts and timestamps", async () => {
    tracesState.pages = [
      createTracePage({
        items: [
          createTraceSummary({
            thread_id: "55555555-5555-4555-8555-555555555555",
            agent_name: "support-agent",
            source: "cron",
            event_count: 42,
            turn_count: 5,
          }),
        ],
      }),
    ];

    await renderThreadsListAt("/traces");

    expect(screen.getByText(/support-agent/i)).toBeInTheDocument();
    // Thread ID is visible (short or full form).
    expect(screen.getByText(/55555555/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/turns?\s*5|5\s*turns?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
  });

  it("exposes each trace row as a native link to its detail (BUG-004)", async () => {
    tracesState.pages = [
      createTracePage({
        items: [
          createTraceSummary({
            thread_id: "55555555-5555-4555-8555-555555555555",
            agent_name: "support-agent",
            source: "cron",
          }),
        ],
      }),
    ];

    await renderThreadsListAt("/traces");

    const row = screen.getByRole("link", { name: /support-agent/i });
    expect(row).toHaveAttribute("href", "/traces/55555555-5555-4555-8555-555555555555");
    // Native link semantics: keyboard Enter navigates; no nested interactive
    // elements inside (Sonar S6819/S6848 stay satisfied).
    expect(row.tagName).toBe("A");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    // The accessible name comes from the row content, not an artificial label.
    expect(row).toHaveTextContent(/support-agent/i);
  });

  it("fetches the next page on Load more, which only exists while a next_cursor is present", async () => {
    tracesState.pages = [
      createTracePage({
        items: [createTraceSummary({ thread_id: "55555555-5555-4555-8555-555555555555" })],
        next_cursor: "cursor-1",
      }),
    ];
    tracesState.hasNextPage = true;
    const user = userEvent.setup();

    const view = renderTracesAt("/traces");

    await user.click(screen.getByRole("tab", { name: /threads/i }));
    await user.click(screen.getByRole("button", { name: /load more|next/i }));

    await waitFor(() => {
      expect(tracesState.fetchNextPage).toHaveBeenCalledTimes(1);
    });

    // Simulate the second page arriving — page-1 rows must SURVIVE (Load
    // more accumulates, it never replaces the loaded page).
    tracesState.pages = [
      createTracePage({
        items: [createTraceSummary({ thread_id: "55555555-5555-4555-8555-555555555555" })],
        next_cursor: "cursor-1",
      }),
      createTracePage({
        items: [createTraceSummary({ thread_id: "thread-456", agent_name: "other-agent" })],
        next_cursor: null,
      }),
    ];
    tracesState.hasNextPage = false;
    view.rerender(
      <Routes>
        <Route path="/traces/:threadId?" element={<TracesPage />} />
      </Routes>,
    );

    expect(screen.getByText(/55555555/)).toBeInTheDocument();
    expect(screen.getByText(/other-agent/i)).toBeInTheDocument();
  });

  it("no Load more control once the last page is reached", async () => {
    tracesState.pages = [createTracePage({ next_cursor: null })];
    tracesState.hasNextPage = false;

    await renderThreadsListAt("/traces");

    expect(screen.queryByRole("button", { name: /load more|next/i })).not.toBeInTheDocument();
  });

  it("changing the agent filter applies the new filter to a fresh first page", async () => {
    tracesState.pages = [createTracePage({ next_cursor: "cursor-1" })];
    tracesState.hasNextPage = true;
    const user = userEvent.setup();

    renderTracesAt("/traces");

    // Page 2 requested first (page-1 rows loaded). The Tabs default view is
    // the Dashboard; the list lives in the Threads sub-tab.
    await user.click(screen.getByRole("tab", { name: /threads/i }));
    await user.click(screen.getByRole("button", { name: /load more|next/i }));
    await waitFor(() => {
      expect(tracesState.fetchNextPage).toHaveBeenCalledTimes(1);
    });

    // Refining the filter changes the applied filter only — pagination
    // resets with the query key, so no next-page fetch carries over.
    await user.type(screen.getByLabelText(/agent/i), "digest-agent");

    await waitFor(() => {
      expect(tracesState.agentName).toBe("digest-agent");
    });
    expect(tracesState.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("shows a filtered no-results state, not an error, when the filter matches nothing", async () => {
    tracesState.pages = [createTracePage({ items: [], next_cursor: null })];

    await renderThreadsListAt("/traces");

    expect(screen.getByText(/no traces|no results/i)).toBeInTheDocument();
    expect(screen.queryByText(/request failed|failed to load/i)).toBeNull();
  });

  it("shows an error state with retry when the list request fails", async () => {
    tracesState.isError = true;
    tracesState.error = new Error("Trace service unavailable");
    const user = userEvent.setup();

    renderTracesAt("/traces");
    await user.click(screen.getByRole("tab", { name: /threads/i }));

    expect(screen.getByText(/trace service unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(tracesState.refetch).toHaveBeenCalled();
  });

  it("shows a loading state while the list loads", async () => {
    tracesState.isLoading = true;

    await renderThreadsListAt("/traces");

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("debounces the agent filter — one applied filter, not one request per keystroke", async () => {
    const user = userEvent.setup();
    renderTracesAt("/traces");
    await user.click(await screen.findByRole("tab", { name: /threads/i }));

    await user.type(screen.getByLabelText(/agent/i), "digest-agent");

    // Within the debounce window the final filter has not been applied yet.
    expect(tracesState.agentName).toBeUndefined();

    // After the debounce window the SINGLE applied filter becomes visible.
    await waitFor(() => {
      expect(tracesState.agentName).toBe("digest-agent");
    });
  });
});

describe("TracesPage — read-only detail", () => {
  beforeEach(() => {
    tracesState.refetch.mockReset();
    tracesState.pages = [];
    tracesState.isLoading = false;
    tracesState.isError = false;
    tracesState.error = undefined;
    threadHistoryState.data = undefined;
    threadHistoryState.isLoading = false;
    threadHistoryState.isError = false;
    threadHistoryState.error = undefined;
    threadHistoryState.refetch.mockReset();
  });

  it("opens the detail for a deep-linked thread id and shows the source pill", async () => {
    threadHistoryState.data = createThreadHistory({
      thread: cronThread,
      turns: [
        createTurn({
          human_message: createMessage({
            role: MessageRole.HUMAN,
            content: "Digest please",
            status: null,
          }),
          ai_message: createMessage({ content: "Here is your digest" }),
          events: [],
        }),
      ],
    });

    renderTracesAt("/traces/55555555-5555-4555-8555-555555555555");

    await waitFor(() => {
      expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/digest please/i)).toBeInTheDocument();
    expect(screen.getByText(/here is your digest/i)).toBeInTheDocument();
  });

  it("detail is read-only — no composer, retry, resume or invoke controls", async () => {
    threadHistoryState.data = createThreadHistory({
      thread: cronThread,
      turns: [],
    });

    renderTracesAt("/traces/55555555-5555-4555-8555-555555555555");

    await waitFor(() => {
      expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /send|run|resume|retry/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /message/i })).not.toBeInTheDocument();
  });

  it("provides a way back from the detail to the global list", async () => {
    threadHistoryState.data = createThreadHistory({
      thread: { ...cronThread, source: "chat" } as unknown as Thread,
      turns: [],
    });

    renderTracesAt("/traces/55555555-5555-4555-8555-555555555555");

    const back = await screen.findByRole("link", { name: /back|all traces/i });
    expect(back.getAttribute("href")).toBe("/traces");
  });

  it("shows an explicit error/not-found state for an inaccessible or missing thread", async () => {
    threadHistoryState.isError = true;
    threadHistoryState.error = new Error("Thread not found");
    const user = userEvent.setup();

    renderTracesAt("/traces/55555555-5555-4555-8555-555555555555");

    await waitFor(() => {
      expect(screen.getByText(/thread not found/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(threadHistoryState.refetch).toHaveBeenCalled();
    // No timeline is rendered while the thread is unavailable.
    expect(screen.queryByLabelText(/thread source/i)).not.toBeInTheDocument();
  });
});
