/**
 * Spec: LLM Usage Dashboard on /traces — Frontend §8-§16.
 * Page contract for the new dashboard default view:
 *  - Default tab = Dashboard with `data-od-id` KPI cards, breakdown charts
 *    (stacked agent bars + model donut) and the Top runs table.
 *  - KPI values render the backend aggregation verbatim (tokens in/out/
 *    total + per-agent sub-lines, cost USD, runs/errors/error rate,
 *    median & p95 duration).
 *  - Charts derive geometry from token shares: bar widths from the largest
 *    agent, donut segments from `stroke-dasharray` percentage units,
 *    token colors only (--accent / --success / --warn / --danger).
 *  - Top runs rows navigate to the existing read-only /traces/:threadId.
 *  - Filters: the exact agent / period (incl. custom from→to) change the
 *    query params of BOTH usage endpoints; the model filter narrows the
 *    RUNS LIST client-side (the endpoints accept no model_name — C3).
 *    Tabs preserve the existing per-thread history (Threads) and expose
 *    the Runs limit control.
 *  - Distinct empty / no-results / error+retry / loading states.
 *
 * Hook contract (repo page-test convention): all trace hooks are mocked;
 * page renders with a real QueryClient + MemoryRouter.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../../utils/render";
import TracesPage from "@/application/pages/TracesPage";
import type { LlmUsageSummary } from "@/domain/entities/trace/llmUsageSummary";
import type { LlmUsageRun } from "@/domain/entities/trace/llmUsageRun";
import { DAY_MS } from "@/domain/entities/trace/llmUsage";
import {
  createLlmUsageSummary,
  createLlmAgentUsage,
  createLlmModelUsage,
  createLlmUsageRun,
} from "../../fixtures/usage";
import { createTracePage, createTraceSummary } from "../../fixtures/registries";
import { createThreadHistory, createTurn, createMessage } from "../../fixtures/external";
import { MessageRole } from "@/domain/entities/chat/message";

const { usageState, topRunsState, agentsState, tracesState, threadHistoryState } = vi.hoisted(
  () => ({
    usageState: {
      params: undefined as
        { agentName?: string; modelName?: string; from?: string; to?: string } | undefined,
      data: undefined as LlmUsageSummary | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    topRunsState: {
      params: undefined as
        | { agentName?: string; modelName?: string; from?: string; to?: string; limit?: number }
        | undefined,
      data: undefined as LlmUsageRun[] | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    agentsState: {
      data: [] as Array<{ name: string }>,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
    },
    tracesState: {
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
  }),
);

vi.mock("@/application/hooks/trace/useTracesUsage", () => ({
  useTracesUsage: (
    params: { agentName?: string; modelName?: string; from?: string; to?: string } = {},
  ) => {
    usageState.params = params;
    return {
      data: usageState.data,
      isLoading: usageState.isLoading,
      isError: usageState.isError,
      error: usageState.error,
      refetch: usageState.refetch,
    };
  },
}));

vi.mock("@/application/hooks/trace/useTopRuns", () => ({
  useTopRuns: (
    params: {
      agentName?: string;
      modelName?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {},
  ) => {
    topRunsState.params = params;
    return {
      data: topRunsState.data,
      isLoading: topRunsState.isLoading,
      isError: topRunsState.isError,
      error: topRunsState.error,
      refetch: topRunsState.refetch,
    };
  },
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => ({
    data: agentsState.data,
    isLoading: agentsState.isLoading,
    isError: agentsState.isError,
    error: agentsState.error,
  }),
}));

vi.mock("@/application/hooks/trace/useTraces", () => ({
  useTraces: () => ({
    data:
      tracesState.pages.length > 0
        ? { pages: tracesState.pages, pageParams: tracesState.pages.map((_, i) => `cursor-${i}`) }
        : undefined,
    isLoading: tracesState.isLoading,
    isError: tracesState.isError,
    error: tracesState.error,
    refetch: tracesState.refetch,
    fetchNextPage: tracesState.fetchNextPage,
    hasNextPage: tracesState.hasNextPage,
    isFetchingNextPage: false,
  }),
}));

vi.mock("@/application/hooks/chat/useThreadHistory", () => ({
  useThreadHistory: () => threadHistoryState,
}));

function renderTraces() {
  return renderWithProviders(
    <Routes>
      <Route path="/traces/:threadId?" element={<TracesPage />} />
    </Routes>,
    { initialEntries: ["/traces"] },
  );
}

/** Radix ui/select pattern: open the trigger by name, then pick an option. */
async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionText: string,
) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  await user.click(await screen.findByRole("option", { name: optionText }));
}

const knownAgents = [
  {
    name: "digest-agent",
    model: "claude-sonnet-4-5",
    minio_path: "/",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
  },
  {
    name: "support-agent",
    model: "gpt-4o",
    minio_path: "/",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
  },
];

function expectDashboardDataOdIds() {
  expect(document.querySelector('[data-od-id="traces-filters"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-kpi-tokens"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-kpi-cost"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-kpi-runs"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-kpi-duration"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-charts-agent"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-charts-model"]')).toBeInTheDocument();
  expect(document.querySelector('[data-od-id="traces-top-runs"]')).toBeInTheDocument();
}

describe("TracesPage — Dashboard tab (default view)", () => {
  beforeEach(() => {
    usageState.params = undefined;
    usageState.data = createLlmUsageSummary();
    usageState.isLoading = false;
    usageState.isError = false;
    usageState.error = undefined;
    usageState.refetch.mockReset();
    usageState.refetch.mockResolvedValue(undefined as never);
    topRunsState.params = undefined;
    topRunsState.data = [createLlmUsageRun()];
    topRunsState.isLoading = false;
    topRunsState.isError = false;
    topRunsState.error = undefined;
    topRunsState.refetch.mockReset();
    topRunsState.refetch.mockResolvedValue(undefined as never);
    agentsState.data = knownAgents;
    agentsState.isLoading = false;
    tracesState.pages = [];
    tracesState.isLoading = false;
    tracesState.isError = false;
    tracesState.error = undefined;
    threadHistoryState.data = undefined;
    threadHistoryState.isLoading = false;
    threadHistoryState.isError = false;
    threadHistoryState.error = undefined;
  });

  it("is the default tab and renders all KPI cards, charts and the top runs table", () => {
    renderTraces();

    const dashboardTab = screen.getByRole("tab", { name: /dashboard/i });
    expect(dashboardTab).toBeInTheDocument();
    expect(dashboardTab).toHaveAttribute("data-state", "active");
    expect(screen.queryByRole("tab", { name: /threads/i })).toHaveAttribute(
      "data-state",
      "inactive",
    );

    expectDashboardDataOdIds();
  });

  it("renders the KPI values from the aggregation: tokens in/out/total, cost, runs/errors, median & p95", () => {
    renderTraces();

    const tokensCard = document.querySelector('[data-od-id="traces-kpi-tokens"]') as HTMLElement;
    expect(within(tokensCard).getByText("15,000")).toBeInTheDocument();
    expect(within(tokensCard).getByText(/in 12,000/i)).toBeInTheDocument();
    expect(within(tokensCard).getByText(/out 3,000/i)).toBeInTheDocument();
    // Per-agent sub-line (top agents by tokens).
    expect(within(tokensCard).getByText(/digest-agent 12k/i)).toBeInTheDocument();

    const costCard = document.querySelector('[data-od-id="traces-kpi-cost"]') as HTMLElement;
    expect(within(costCard).getByText("$0.42")).toBeInTheDocument();
    expect(within(costCard).getByText(/all models priced/i)).toBeInTheDocument();

    const runsCard = document.querySelector('[data-od-id="traces-kpi-runs"]') as HTMLElement;
    // Backend contract (review C2): run_count IS the completed count ("ok"),
    // error_count is disjoint from it — no subtraction.
    expect(within(runsCard).getByText("10")).toBeInTheDocument();
    expect(within(runsCard).getByText(/10 ok/i)).toBeInTheDocument();
    expect(within(runsCard).getByText(/1 errors/i)).toBeInTheDocument();
    expect(within(runsCard).getByText(/error rate 9\.1%/i)).toBeInTheDocument();

    const durationCard = document.querySelector(
      '[data-od-id="traces-kpi-duration"]',
    ) as HTMLElement;
    expect(within(durationCard).getByText("1.2 s")).toBeInTheDocument();
    expect(within(durationCard).getByText(/p95 4\.8 s/i)).toBeInTheDocument();
  });

  it("renders the agent bar chart with stacked input/output segments from token shares", () => {
    usageState.data = createLlmUsageSummary({
      series: {
        by_agent: [
          createLlmAgentUsage({
            agent_name: "digest-agent",
            input_tokens: 9_000,
            output_tokens: 3_000,
            total_tokens: 12_000,
          }),
          createLlmAgentUsage({
            agent_name: "support-agent",
            input_tokens: 1_000,
            output_tokens: 3_000,
            total_tokens: 4_000,
          }),
        ],
        by_model: [createLlmModelUsage()],
      },
    });

    renderTraces();

    const chart = document.querySelector('[data-od-id="traces-charts-agent"]') as HTMLElement;
    expect(
      within(chart).getByRole("img", { name: /digest-agent: 9k input tokens, 3k output tokens/i }),
    ).toBeInTheDocument();
    expect(
      within(chart).getByRole("img", { name: /support-agent: 1k input tokens, 3k output tokens/i }),
    ).toBeInTheDocument();

    // Digest = largest agent → 100% wide track; input 75%, output 25%.
    const digestTrack = within(chart).getByRole("img", { name: /digest-agent: 9k input tokens/i });
    const digestSegments = digestTrack.querySelectorAll("div");
    expect(digestSegments).toHaveLength(2);
    expect(digestSegments[0]).toHaveClass("bg-accent");
    expect(digestSegments[1]).toHaveClass("bg-success");
    expect(digestSegments[0]).toHaveStyle({ width: "75%" });
    expect(digestSegments[1]).toHaveStyle({ width: "25%", left: "75%" });

    // Support scales against the max: 4,000/12,000 ≈ 33.3% wide.
    const supportTrack = within(chart).getByRole("img", {
      name: /support-agent: 1k input tokens/i,
    });
    expect(parseFloat((supportTrack as HTMLElement).style.width)).toBeCloseTo(33.3, 1);
  });

  it("renders the model donut with stroke-dasharray shares and legend", () => {
    usageState.data = createLlmUsageSummary({
      total_tokens: 25_000,
      series: {
        by_agent: [createLlmAgentUsage()],
        by_model: [
          createLlmModelUsage({ model_name: "claude-sonnet-4-5", total_tokens: 15_000 }),
          createLlmModelUsage({ model_name: "gpt-4o", total_tokens: 10_000, priced: true }),
        ],
      },
    });

    renderTraces();

    const donutPanel = document.querySelector('[data-od-id="traces-charts-model"]') as HTMLElement;
    // Native <figure> accessibility (Sonar S6819 fix): the chart's
    // description lives on the figure's aria-label; the svg is visual-only.
    const donut = within(donutPanel).getByRole("figure", { name: /tokens by model/i });
    // aria-label carries the human-readable shares per model.
    expect(within(donutPanel).getByText(/claude-sonnet-4-5/)).toBeInTheDocument();

    // Track circle + one segment per model; shares are dasharray percentage
    // units (60% / 40%), starting at 12 o'clock via dashoffset 25.
    const circles = donut.querySelectorAll("circle");
    expect(circles).toHaveLength(3);
    expect(circles[0]).toHaveClass("stroke-border-soft");
    expect(circles[1]).toHaveAttribute("stroke-dasharray", "60 40");
    expect(circles[1]).toHaveAttribute("stroke-dashoffset", "25");
    expect(circles[1]).toHaveClass("stroke-accent");
    expect(circles[2]).toHaveAttribute("stroke-dasharray", "40 60");
    expect(circles[2]).toHaveAttribute("stroke-dashoffset", "65");
    expect(circles[2]).toHaveClass("stroke-success");

    expect(within(donutPanel).getByText(/15k · 60%/i)).toBeInTheDocument();
    expect(within(donutPanel).getByText(/10k · 40%/i)).toBeInTheDocument();
  });

  it("flags unpriced models on the cost card and in the donut legend", () => {
    usageState.data = createLlmUsageSummary({
      series: {
        by_agent: [createLlmAgentUsage()],
        by_model: [createLlmModelUsage({ priced: false, cost_usd: 0 })],
      },
    });

    renderTraces();

    const costCard = document.querySelector('[data-od-id="traces-kpi-cost"]') as HTMLElement;
    expect(within(costCard).getByText(/1 unpriced model/i)).toBeInTheDocument();
    const donutPanel = document.querySelector('[data-od-id="traces-charts-model"]') as HTMLElement;
    expect(within(donutPanel).getByText(/^unpriced$/i)).toBeInTheDocument();
  });

  it("lists the top runs with agent, model, tokens, cost, duration and navigates to the read-only detail on click", async () => {
    threadHistoryState.data = createThreadHistory({
      thread: {
        id: "55555555-5555-4555-8555-555555555555",
        agent_name: "digest-agent",
        created_at: "2026-11-15T12:00:00Z",
        updated_at: "2026-11-15T12:05:00Z",
        source: "chat",
      } as never,
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

    const user = userEvent.setup();
    renderTraces();

    const row = screen.getByRole("link", { name: /digest-agent.*claude-sonnet-4-5/i });
    expect(row).toHaveAttribute("href", "/traces/55555555-5555-4555-8555-555555555555");
    expect(row.tagName).toBe("A");
    expect(within(row).getByText("$0.04")).toBeInTheDocument();
    expect(within(row).getByText("1.5k")).toBeInTheDocument();
    expect(within(row).getByText("4.4 s")).toBeInTheDocument();

    await user.click(row);

    await waitFor(() => {
      expect(screen.getByText(/digest please/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/here is your digest/i)).toBeInTheDocument();
  });

  it("limits the dashboard top runs table to the fixed top-10", () => {
    renderTraces();

    expect(topRunsState.params?.limit).toBe(10);
  });

  it("changing the exact agent filter re-queries both endpoints with agent_name", async () => {
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /agent/i, "support-agent");

    await waitFor(() => expect(usageState.params?.agentName).toBe("support-agent"));
    expect(topRunsState.params?.agentName).toBe("support-agent");
  });

  it("changing the model filter never re-queries the summary and feeds the runs list client-side", async () => {
    // Review C3: the backend endpoints accept no model_name, so the model
    // control is a client-side runs-list filter — the usage summary must
    // not receive any model parameter and must not be re-queried for it.
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /model/i, "claude-sonnet-4-5");

    await waitFor(() => expect(topRunsState.params?.modelName).toBe("claude-sonnet-4-5"));
    expect(usageState.params?.modelName).toBeUndefined();
    // The rows are really narrowed in useTopRuns (hook-level test) — the
    // page only forwards the selection without touching the query keys.
    expect(usageState.params?.agentName).toBeUndefined();
  });

  it("changing the period to 30 days re-queries with an ISO from bound and no to bound", async () => {
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /period/i, "30 days");

    await waitFor(() => expect(usageState.params?.from).toMatch(/^\d{4}-\d{2}-\d{2}T/));
    expect(usageState.params?.to).toBeUndefined();
    expect(topRunsState.params?.from).toBe(usageState.params?.from);
    expect(topRunsState.params?.to).toBeUndefined();
  });

  it("custom period exposes From/To date inputs and only applies once BOTH bounds are picked", async () => {
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /period/i, "Custom range");

    const from = screen.getByLabelText(/^from$/i) as HTMLInputElement;
    const to = screen.getByLabelText(/^to$/i) as HTMLInputElement;
    expect(from).toHaveAttribute("type", "date");
    expect(to).toHaveAttribute("type", "date");

    fireEvent.change(from, { target: { value: "2026-11-01" } });
    // BUG-005: a half-picked custom range is INCOMPLETE — the custom bound
    // must NOT be sent yet (an unbounded/half-bounded request never leaks).
    await waitFor(() => expect(usageState.params?.from).toMatch(/^\d{4}-\d{2}-\d{2}T/));
    expect(usageState.params?.from).not.toBe("2026-11-01T00:00:00.000Z");
    // The incomplete state is announced honestly next to the pickers.
    expect(
      screen.getByText(/7-day window stays active until both dates are picked/i),
    ).toHaveAttribute("data-od-id", "traces-filters-range-hint");

    // Picking BOTH bounds activates the custom window over both endpoints.
    fireEvent.change(to, { target: { value: "2026-11-05" } });
    await waitFor(() => {
      expect(usageState.params?.from).toBe("2026-11-01T00:00:00.000Z");
      expect(usageState.params?.to).toBe("2026-11-05T23:59:59.999Z");
    });
    expect(topRunsState.params?.from).toBe("2026-11-01T00:00:00.000Z");
    expect(topRunsState.params?.to).toBe("2026-11-05T23:59:59.999Z");
    // Fully applied → the incompleteness hint disappears.
    await waitFor(() =>
      expect(
        document.querySelector('[data-od-id="traces-filters-range-hint"]'),
      ).not.toBeInTheDocument(),
    );
  });

  it("Custom range with NO date picked keeps the bounded 7-day window (never all-time)", async () => {
    // BUG-005 regression: previously an empty custom range produced a
    // request WITHOUT from/to — the user's whole history got aggregated
    // silently while the filter bar showed two empty date inputs.
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /period/i, "Custom range");

    await waitFor(() => expect(usageState.params?.from).toMatch(/^\d{4}-\d{2}-\d{2}T/));
    expect(usageState.params?.to).toBeUndefined();
    expect(topRunsState.params?.from).toBe(usageState.params?.from);
    expect(topRunsState.params?.to).toBeUndefined();
    expect(
      screen.getByText(/7-day window stays active until both dates are picked/i),
    ).toBeInTheDocument();
  });

  it("shows an explicit empty state when no usage was recorded in the period", () => {
    usageState.data = createLlmUsageSummary({
      run_count: 0,
      error_count: 0,
      total_tokens: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      duration_ms_p50: null,
      duration_ms_p95: null,
      series: { by_agent: [], by_model: [] },
    });

    renderTraces();

    expect(document.querySelector('[data-od-id="traces-usage-empty"]')).toBeInTheDocument();
    expect(screen.getByText(/no llm usage recorded/i)).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-kpi-tokens"]')).not.toBeInTheDocument();
  });

  it("surfaces an error-only window as KPIs — it is NOT an empty state (review C2)", () => {
    // run_count counts COMPLETED runs, error_count ERROR runs (disjoint):
    // 0 completed + 2 errors must render the runs card, never the empty state.
    usageState.data = createLlmUsageSummary({
      run_count: 0,
      error_count: 2,
      total_tokens: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      duration_ms_p50: null,
      duration_ms_p95: null,
      series: { by_agent: [], by_model: [] },
    });

    renderTraces();

    expect(document.querySelector('[data-od-id="traces-usage-empty"]')).not.toBeInTheDocument();
    const runsCard = document.querySelector('[data-od-id="traces-kpi-runs"]') as HTMLElement;
    expect(within(runsCard).getByText(/0 ok · 2 errors/i)).toBeInTheDocument();
    expect(within(runsCard).getByText(/error rate 100\.0%/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when the usage request fails", async () => {
    usageState.isError = true;
    usageState.error = new Error("Usage service down");
    const user = userEvent.setup();

    renderTraces();

    expect(screen.getByText(/usage service down/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(usageState.refetch).toHaveBeenCalled();
  });

  it("shows a loading state while the usage aggregates load", () => {
    usageState.isLoading = true;

    renderTraces();

    expect(screen.getByText(/loading usage/i)).toBeInTheDocument();
  });

  it("keeps the KPI cards visible and surfaces the top runs error with its own retry", async () => {
    topRunsState.isError = true;
    topRunsState.error = new Error("Top runs unavailable");
    const user = userEvent.setup();

    renderTraces();

    expect(document.querySelector('[data-od-id="traces-kpi-tokens"]')).toBeInTheDocument();
    expect(screen.getByText(/top runs unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(topRunsState.refetch).toHaveBeenCalled();
  });

  it("applies the default 7-day window to both endpoints on first render", () => {
    renderTraces();

    expect(usageState.params?.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(usageState.params?.to).toBeUndefined();
    expect(topRunsState.params?.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(topRunsState.params?.to).toBeUndefined();
    // The single `from` bound sits ~7 days ago (small clock slack allowed).
    const fromMs = new Date(usageState.params?.from ?? "").getTime();
    expect(Math.abs(fromMs - (Date.now() - 7 * DAY_MS))).toBeLessThan(60_000);
  });

  it("resets the agent and model filters back to All without leaking them into the query", async () => {
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /agent/i, "support-agent");
    await waitFor(() => expect(usageState.params?.agentName).toBe("support-agent"));

    await chooseOption(user, /agent/i, "All agents");
    await waitFor(() => expect(usageState.params?.agentName).toBeUndefined());
    expect(topRunsState.params?.agentName).toBeUndefined();

    await chooseOption(user, /model/i, "claude-sonnet-4-5");
    await waitFor(() => expect(topRunsState.params?.modelName).toBe("claude-sonnet-4-5"));
    // The summary endpoint never sees a model parameter (client-side filter).
    expect(usageState.params?.modelName).toBeUndefined();

    await chooseOption(user, /model/i, "All models");
    await waitFor(() => expect(topRunsState.params?.modelName).toBeUndefined());
  });

  it("renders the top runs in the backend-provided cost order without re-sorting", () => {
    topRunsState.data = [
      createLlmUsageRun({
        thread_id: "aaaaaaaa-1111-4111-8111-111111111111",
        turn_id: "turn-1",
        agent_name: "alpha-agent",
        cost_usd: 0.99,
      }),
      createLlmUsageRun({
        thread_id: "bbbbbbbb-2222-4222-8222-222222222222",
        turn_id: "turn-2",
        agent_name: "beta-agent",
        model_name: "gpt-4o",
        cost_usd: 0.5,
      }),
      createLlmUsageRun({
        thread_id: "cccccccc-3333-4333-8333-333333333333",
        turn_id: "turn-3",
        agent_name: "gamma-agent",
        model_name: null,
        cost_usd: 0.01,
      }),
    ];

    renderTraces();

    const rows = document.querySelectorAll('[data-od-id="traces-top-runs-row"]');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("alpha-agent");
    expect(rows[1].textContent).toContain("beta-agent");
    expect(rows[2].textContent).toContain("gamma-agent");
    expect(within(rows[0] as HTMLElement).getByText("$0.99")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("$0.50")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("$0.01")).toBeInTheDocument();
    // Legacy run without a model name falls back to the "unknown" marker.
    expect(within(rows[2] as HTMLElement).getByText("unknown")).toBeInTheDocument();
  });

  it("renders per-chart empty states while the KPI row stays for a tokens-less window", () => {
    // Legacy/error-only window: runs counted, but no usage_metadata tokens.
    usageState.data = createLlmUsageSummary({
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      run_count: 3,
      error_count: 1,
      duration_ms_p50: null,
      duration_ms_p95: null,
      series: { by_agent: [], by_model: [] },
    });
    topRunsState.data = [];

    renderTraces();

    expect(document.querySelector('[data-od-id="traces-kpi-tokens"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-usage-empty"]')).not.toBeInTheDocument();
    expect(screen.getByText(/no agent usage in the selected period/i)).toBeInTheDocument();
    expect(screen.getByText(/no model usage in the selected period/i)).toBeInTheDocument();
    expect(screen.getByText(/no runs match the selected filters/i)).toBeInTheDocument();
  });

  it("formats sub-second durations in ms and sub-cent costs with four decimals", () => {
    usageState.data = createLlmUsageSummary({
      total_cost_usd: 0.0042,
      duration_ms_p50: 350,
      duration_ms_p95: 980,
    });

    renderTraces();

    const durationCard = document.querySelector(
      '[data-od-id="traces-kpi-duration"]',
    ) as HTMLElement;
    expect(within(durationCard).getByText("350 ms")).toBeInTheDocument();
    expect(within(durationCard).getByText(/p95 980 ms/i)).toBeInTheDocument();

    const costCard = document.querySelector('[data-od-id="traces-kpi-cost"]') as HTMLElement;
    expect(within(costCard).getByText("$0.0042")).toBeInTheDocument();
  });

  it("shows the top three agents by tokens in the tokens card sub-line", () => {
    usageState.data = createLlmUsageSummary({
      series: {
        by_agent: [
          createLlmAgentUsage({ agent_name: "alpha-agent", total_tokens: 12_000 }),
          createLlmAgentUsage({ agent_name: "beta-agent", total_tokens: 4_000 }),
          createLlmAgentUsage({ agent_name: "gamma-agent", total_tokens: 1_000 }),
          createLlmAgentUsage({ agent_name: "delta-agent", total_tokens: 500 }),
        ],
        by_model: [createLlmModelUsage()],
      },
    });

    renderTraces();

    const tokensCard = document.querySelector('[data-od-id="traces-kpi-tokens"]') as HTMLElement;
    expect(
      within(tokensCard).getByText(/alpha-agent 12k · beta-agent 4k · gamma-agent 1k/),
    ).toBeInTheDocument();
    // Only the top three: the smallest agent is cut from the sub-line.
    expect(within(tokensCard).queryByText(/delta-agent/)).not.toBeInTheDocument();
  });

  it("labels the dashboard shell, filter triggers, charts and run rows with stable data-od-id", () => {
    renderTraces();

    expect(document.querySelector('[data-od-id="traces-view"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-filters-agent"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-filters-model"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-filters-period"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-top-runs-section"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-top-runs-row"]')).toBeInTheDocument();
  });
});

describe("TracesPage — Runs tab", () => {
  beforeEach(() => {
    usageState.params = undefined;
    usageState.data = createLlmUsageSummary();
    usageState.isLoading = false;
    usageState.isError = false;
    usageState.error = undefined;
    usageState.refetch.mockReset();
    topRunsState.params = undefined;
    topRunsState.data = [createLlmUsageRun()];
    topRunsState.isLoading = false;
    topRunsState.isError = false;
    topRunsState.error = undefined;
    topRunsState.refetch.mockReset();
    agentsState.data = knownAgents;
    tracesState.pages = [];
    threadHistoryState.data = undefined;
  });

  it("reuses the same filters and the same top-runs table with a limit control", async () => {
    const user = userEvent.setup();
    renderTraces();

    await user.click(screen.getByRole("tab", { name: /runs/i }));

    await waitFor(() => expect(topRunsState.params?.limit).toBe(25));
    expect(document.querySelector('[data-od-id="traces-filters"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-top-runs"]')).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /digest-agent.*claude-sonnet-4-5/i }),
    ).toBeInTheDocument();

    await chooseOption(user, /limit/i, "Top 50");

    await waitFor(() => expect(topRunsState.params?.limit).toBe(50));
  });

  it("shows a no-results state when no runs match the filters", async () => {
    topRunsState.data = [];

    renderTraces();
    await userEvent.setup().click(await screen.findByRole("tab", { name: /runs/i }));

    expect(screen.getByText(/no runs match/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /digest-agent/i })).not.toBeInTheDocument();
  });

  it("reports the narrowed pool honestly when a model filter returns zero rows (BUG-004)", async () => {
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /model/i, "claude-sonnet-4-5");
    topRunsState.data = [];

    await user.click(await screen.findByRole("tab", { name: /runs/i }));

    // The model HAS runs in the window (it is offered by the dropdown);
    // the empty state must state the real reason — the fetched top-100 —
    // never "this model produced no runs".
    expect(
      screen.getByText(/no runs from the selected model in the fetched top 100/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no runs match\./i)).not.toBeInTheDocument();
  });

  it("renders run costs with enough precision for sub-cent rows (BUG-001)", () => {
    // The QA-observed 1-in/1-out-token run: the backend sends 1.25e-05;
    // the row cost cell must not read "$0.0000".
    topRunsState.data = [createLlmUsageRun({ cost_usd: 1.25e-5 })];

    renderTraces();

    const row = document.querySelector('[data-od-id="traces-top-runs-row"]') as HTMLElement;
    expect(within(row).getByText("$0.00001")).toBeInTheDocument();
    expect(within(row).queryByText("$0.0000")).not.toBeInTheDocument();
  });

  it("passes the shared filters to the top runs endpoint", async () => {
    const user = userEvent.setup();
    renderTraces();

    await chooseOption(user, /agent/i, "support-agent");
    await user.click(screen.getByRole("tab", { name: /runs/i }));

    await waitFor(() => expect(topRunsState.params?.agentName).toBe("support-agent"));
  });

  it("labels the runs limit control and run rows with stable data-od-id", async () => {
    const user = userEvent.setup();
    renderTraces();

    await user.click(screen.getByRole("tab", { name: /runs/i }));

    expect(document.querySelector('[data-od-id="traces-runs-limit"]')).toBeInTheDocument();
    expect(document.querySelector('[data-od-id="traces-top-runs-row"]')).toBeInTheDocument();
  });
});

describe("TracesPage — Threads tab preserves the per-thread history", () => {
  beforeEach(() => {
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
    tracesState.hasNextPage = true;
  });

  it("keeps the existing trace rows, source pill and load-more when the Threads tab is opened", async () => {
    const user = userEvent.setup();
    renderTraces();

    await user.click(await screen.findByRole("tab", { name: /threads/i }));

    expect(screen.getByText(/support-agent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thread source: cron/i)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    const row = screen.getByRole("link", { name: /support-agent/i });
    expect(row).toHaveAttribute("href", "/traces/55555555-5555-4555-8555-555555555555");
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });
});
