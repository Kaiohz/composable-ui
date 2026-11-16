/**
 * Spec: prompts-models-crons-traces.md §CRN-001..CRN-007, §5.4 (Cron UX)
 * Page contract (/crons):
 *  - List rows/card: name, agent, expression, timezone, enabled state, next
 *    run, last-run status/timestamp; create/edit/delete controls;
 *    enable/disable; Run now; run history (trigger, status, timing, safe
 *    failure details, CRON source pill, trace link when a thread exists).
 *  - Create/validation errors: exactly five-field expression (no seconds),
 *    valid IANA timezone, known agent, non-empty message.
 *  - Empty states for no crons and no runs.
 *
 * Hook contract Step 2 must implement (repo page-test convention):
 *  - @/application/hooks/cron/useCrons        → list query
 *  - @/application/hooks/cron/useCreateCron   → mutation {name, agent_name, message, cron_expression, timezone, enabled?}
 *  - @/application/hooks/cron/useUpdateCron   → mutation {id, patch}
 *  - @/application/hooks/cron/useDeleteCron   → mutation (id)
 *  - @/application/hooks/cron/useRunCron      → mutation (id)
 *  - @/application/hooks/cron/useCronRuns     → paginated query (cronId | null, {limit?, cursor?})
 * The agent list for the create/edit form comes from the existing
 * @/application/hooks/agent/useAgents hook.
 *
 * Step-1 (Red): the page and hooks do not exist yet.
 */
import { screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import CronsPage from "@/application/pages/CronsPage";
import type { CronSchedule, CronRun } from "../../fixtures/registries";
import { createCronSchedule, createCronRun } from "../../fixtures/registries";
import { createAgentConfigMetadata } from "../../fixtures/external";

const {
  cronsState,
  cronRunsState,
  agentsState,
  createCronMutate,
  updateCronMutate,
  deleteCronMutate,
  runCronMutate,
} = vi.hoisted(() => ({
  cronsState: {
    data: undefined as CronSchedule[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  cronRunsState: {
    cronId: null as string | null,
    data: undefined as CronRun[] | undefined,
    isLoading: false,
  },
  agentsState: {
    data: undefined as ReturnType<typeof createAgentConfigMetadata>[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  createCronMutate: vi.fn(),
  updateCronMutate: vi.fn(),
  deleteCronMutate: vi.fn(),
  runCronMutate: vi.fn(),
}));

vi.mock("@/application/hooks/cron/useCrons", () => ({
  useCrons: () => cronsState,
}));

vi.mock("@/application/hooks/cron/useCronRuns", () => ({
  useCronRuns: (cronId: string | null, _opts?: unknown) => {
    cronRunsState.cronId = cronId;
    return cronRunsState;
  },
}));

vi.mock("@/application/hooks/cron/useCreateCron", () => ({
  useCreateCron: () => ({ mutate: createCronMutate, isPending: false }),
}));

vi.mock("@/application/hooks/cron/useUpdateCron", () => ({
  useUpdateCron: () => ({ mutate: updateCronMutate, isPending: false }),
}));

vi.mock("@/application/hooks/cron/useDeleteCron", () => ({
  useDeleteCron: () => ({ mutate: deleteCronMutate, isPending: false }),
}));

vi.mock("@/application/hooks/cron/useRunCron", () => ({
  useRunCron: () => ({ mutate: runCronMutate, isPending: false }),
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => agentsState,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function cronButton(user: ReturnType<typeof userEvent.setup>, name: string, buttonPattern: RegExp) {
  const row = screen.getByText(name).closest("[data-od-id]");
  if (!row) throw new Error(`Cron row for ${name} not found`);
  return user.click(within(row as HTMLElement).getByRole("button", { name: buttonPattern }));
}

/**
 * Chooses an option in a select control by accessible name (Radix
 * ui/select pattern is the only select implementation in this codebase).
 */
async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionText: string,
) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  await user.click(await screen.findByRole("option", { name: optionText }));
}

describe("CronsPage", () => {
  beforeEach(() => {
    createCronMutate.mockReset();
    updateCronMutate.mockReset();
    deleteCronMutate.mockReset();
    runCronMutate.mockReset();
    cronsState.refetch.mockReset();
    cronsState.data = undefined;
    cronsState.isLoading = false;
    cronsState.isError = false;
    cronsState.error = undefined;
    cronRunsState.data = undefined;
    cronRunsState.isLoading = false;
    agentsState.data = [createAgentConfigMetadata({ name: "digest-agent" })];
    agentsState.isLoading = false;
    agentsState.isError = false;
    agentsState.error = undefined;
    agentsState.refetch.mockReset();
  });

  it("shows a neutral loading state — not the empty message — while the agent list loads (BUG-001)", async () => {
    agentsState.data = undefined;
    agentsState.isLoading = true;
    cronsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    await user.click(screen.getByRole("button", { name: /new cron/i }));

    // In flight: no empty claim, a neutral loading label instead.
    await waitFor(() => {
      expect(screen.getByText(/loading agents/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/no agents available/i)).not.toBeInTheDocument();
  });

  it("shows an explicit retryable error when the agent list request fails (BUG-001)", async () => {
    agentsState.data = undefined;
    agentsState.isError = true;
    agentsState.error = new Error("Agents backend down");
    cronsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    await user.click(screen.getByRole("button", { name: /new cron/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/agents backend down/i);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(agentsState.refetch).toHaveBeenCalled();
    expect(screen.queryByText(/no agents available/i)).not.toBeInTheDocument();
  });

  it("claims an empty agent list only once the query RESOLVED empty (BUG-001)", async () => {
    agentsState.data = [];
    cronsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    await user.click(screen.getByRole("button", { name: /new cron/i }));

    await waitFor(() => {
      expect(screen.getByText(/no agents available/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/loading agents/i)).not.toBeInTheDocument();
  });

  it("lists crons with name, agent, expression, timezone, enabled and next run", () => {
    cronsState.data = [
      createCronSchedule({
        name: "daily-digest",
        agent_name: "digest-agent",
        cron_expression: "0 9 * * *",
        timezone: "Europe/Paris",
        enabled: true,
        next_run_at: "2026-11-17T09:00:00Z",
        last_run_status: "succeeded",
        last_run_at: "2026-11-16T09:00:00Z",
      }),
    ];

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    expect(screen.getByText("daily-digest")).toBeInTheDocument();
    expect(screen.getByText("digest-agent")).toBeInTheDocument();
    expect(screen.getByText("0 9 * * *")).toBeInTheDocument();
    expect(screen.getByText(/europe\/paris/i)).toBeInTheDocument();
    expect(screen.getByText(/enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/nov.*17/i)).toBeInTheDocument();
    // Wire format: the last-run STATUS BADGE renders from the flat
    // last_run_status field (backend CronResponse), and the last-run
    // timestamp renders from last_run_at.
    expect(screen.getByText(/succeeded/i)).toBeInTheDocument();
    expect(screen.getByText(/nov.*16/i)).toBeInTheDocument();
  });

  it("shows loading and empty states", () => {
    cronsState.isLoading = true;
    const { unmount } = renderWithProviders(<CronsPage />, {
      initialEntries: ["/crons"],
    });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    unmount();

    cronsState.isLoading = false;
    cronsState.data = [];
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    expect(screen.getByText(/no crons/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when listing fails", async () => {
    cronsState.isError = true;
    cronsState.error = new Error("Backend unavailable");
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    expect(screen.getByText(/backend unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(cronsState.refetch).toHaveBeenCalled();
  });

  it("creates a cron with UTC timezone default and enabled by default", async () => {
    cronsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await user.click(screen.getByRole("button", { name: /new cron/i }));

    await user.type(screen.getByLabelText(/^name$/i), "daily-digest");
    await chooseOption(user, /^agent$/i, "digest-agent");
    await user.type(screen.getByLabelText(/^message$/i), "Summarize the news");
    await user.type(screen.getByLabelText(/cron expression/i), "0 9 * * *");
    // Timezone left on its default → UTC.
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createCronMutate).toHaveBeenCalledWith(
      {
        name: "daily-digest",
        agent_name: "digest-agent",
        message: "Summarize the news",
        cron_expression: "0 9 * * *",
        timezone: "UTC",
        enabled: true,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("rejects a six-field cron expression without calling the API", async () => {
    cronsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await user.click(screen.getByRole("button", { name: /new cron/i }));

    await user.type(screen.getByLabelText(/^name$/i), "bad-expression");
    await chooseOption(user, /^agent$/i, "digest-agent");
    await user.type(screen.getByLabelText(/^message$/i), "Hello");
    await user.type(screen.getByLabelText(/cron expression/i), "0 9 * * * *");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createCronMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/five fields|invalid cron/i)).toBeInTheDocument();
  });

  it("rejects an invalid IANA timezone without calling the API", async () => {
    cronsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await user.click(screen.getByRole("button", { name: /new cron/i }));

    await user.type(screen.getByLabelText(/^name$/i), "bad-zone");
    await chooseOption(user, /^agent$/i, "digest-agent");
    await user.type(screen.getByLabelText(/^message$/i), "Hello");
    await user.type(screen.getByLabelText(/cron expression/i), "0 9 * * *");
    await user.type(screen.getByLabelText(/time ?zone/i), "Mars/Olympus");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createCronMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/timezone/i)).toBeInTheDocument();
  });

  it("disables and re-enables a cron via the enable/disable control", async () => {
    cronsState.data = [createCronSchedule({ name: "daily-digest", enabled: true })];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await cronButton(user, "daily-digest", /disable/i);

    expect(updateCronMutate).toHaveBeenCalledWith(
      { id: "33333333-3333-4333-8333-333333333333", enabled: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("triggers Run now on a cron, including disabled crons", async () => {
    cronsState.data = [createCronSchedule({ name: "daily-digest", enabled: false })];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    expect(screen.getByText(/disabled/i)).toBeInTheDocument();

    await cronButton(user, "daily-digest", /run now/i);

    expect(runCronMutate).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows paginated run history newest first with trigger, status and timing", async () => {
    cronsState.data = [createCronSchedule({ name: "daily-digest" })];
    cronRunsState.data = [
      createCronRun({
        id: "run-2",
        trigger: "manual",
        status: "failed",
        thread_id: null,
        source: null,
        error: "Agent requires user runtime placeholders",
        occurrence_at: null,
        started_at: "2026-11-16T12:00:00Z",
      }),
      createCronRun({
        id: "run-1",
        trigger: "scheduled",
        status: "succeeded",
        started_at: "2026-11-16T09:00:00Z",
      }),
    ];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await cronButton(user, "daily-digest", /run history/i);

    await waitFor(() => {
      expect(cronRunsState.cronId).toBe("33333333-3333-4333-8333-333333333333");
    });

    const triggers = screen
      .getAllByText(/manual|scheduled/)
      .map((el) => el.textContent?.toLowerCase());
    expect(triggers.indexOf("manual")).toBeLessThan(triggers.indexOf("scheduled"));
    expect(screen.getByText(/agent requires user runtime placeholders/i)).toBeInTheDocument();
  });

  it("run history entries with a thread show the CRON source pill and a trace link", async () => {
    cronsState.data = [createCronSchedule({ name: "daily-digest" })];
    cronRunsState.data = [
      createCronRun({
        thread_id: "55555555-5555-4555-8555-555555555555",
        source: "cron",
      }),
    ];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await cronButton(user, "daily-digest", /run history/i);

    const pill = await screen.findByLabelText(/thread source: cron/i);
    expect(pill).toBeInTheDocument();

    const link = screen.queryByRole("link", {
      name: /view trace|open trace|trace/i,
    });
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", "/traces/55555555-5555-4555-8555-555555555555");
  });

  it("run history shows an empty state when there are no runs", async () => {
    cronsState.data = [createCronSchedule({ name: "daily-digest" })];
    cronRunsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await cronButton(user, "daily-digest", /run history/i);

    await waitFor(() => {
      expect(screen.getByText(/no runs/i)).toBeInTheDocument();
    });
  });

  it("deletes a cron after destructive confirmation", async () => {
    cronsState.data = [createCronSchedule({ name: "obsolete-job" })];
    const user = userEvent.setup();

    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });
    await cronButton(user, "obsolete-job", /^delete$/i);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(deleteCronMutate).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
