/**
 * Spec: unify-cards-modals.md — Shared resource cards
 * (CARD-003, CARD-004, CARD-005, CARD-006, CARD-007, CARD-008, CARD-009, CARD-012).
 *
 * Crons rendered through the real /crons page must appear as Agent-style
 * resource cards in the standard responsive grid (no longer full-width
 * rows), while keeping every existing data point, workflow action,
 * stable `data-od-id` and the two-step delete confirmation.
 *
 * Step-1 (Red): CronRow is a flat full-width row (`flex flex-col gap-4`
 * list) with a text delete button and no icon block.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import CronsPage from "@/application/pages/CronsPage";
import type { CronSchedule } from "../../fixtures/registries";
import { createCronSchedule } from "../../fixtures/registries";

const { cronsState, deleteCronMutate, updateCronMutate, runCronMutate } = vi.hoisted(() => ({
  cronsState: {
    data: undefined as CronSchedule[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  deleteCronMutate: vi.fn(),
  updateCronMutate: vi.fn(),
  runCronMutate: vi.fn(),
}));

vi.mock("@/application/hooks/cron/useCrons", () => ({
  useCrons: () => cronsState,
}));

vi.mock("@/application/hooks/cron/useCronRuns", () => ({
  useCronRuns: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/application/hooks/cron/useCreateCron", () => ({
  useCreateCron: () => ({ mutate: vi.fn(), isPending: false }),
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
  useAgents: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const REFERENCE_CONTAINER_TOKENS = [
  "block-shadow-raised",
  "hover:-translate-y-0.5",
  "hover:border-accent",
] as const;

const REFERENCE_ICON_BLOCK_TOKENS = ["h-12", "w-12", "bg-surface-warm", "text-accent"] as const;

function cronCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-od-id="cron-row"]');
  if (!card) throw new Error("Cron card not found");
  return card;
}

describe("CronsPage unified resource card", () => {
  beforeEach(() => {
    deleteCronMutate.mockReset();
    updateCronMutate.mockReset();
    runCronMutate.mockReset();
    cronsState.data = [createCronSchedule()];
    cronsState.isLoading = false;
    cronsState.isError = false;
    cronsState.error = undefined;
  });

  it("renders scheduled crons in the standard responsive resource grid (CARD-009)", () => {
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    const grid = document.querySelector<HTMLElement>('[data-od-id="crons-list"]');
    expect(grid).not.toBeNull();
    const tokens = ["grid", "grid-cols-1", "gap-6", "md:grid-cols-2", "lg:grid-cols-3"];
    for (const token of tokens) {
      expect(grid?.classList.contains(token)).toBe(true);
    }
  });

  it("applies the Agent-reference raised/hover card treatment with an icon block (CARD-003, CARD-004)", () => {
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    const card = cronCard();
    for (const token of REFERENCE_CONTAINER_TOKENS) {
      expect(card.classList.contains(token)).toBe(true);
    }
    const iconBlock = card.querySelector("div[class*='h-12'][class*='w-12']");
    expect(iconBlock).not.toBeNull();
    for (const token of REFERENCE_ICON_BLOCK_TOKENS) {
      expect(iconBlock?.classList.contains(token)).toBe(true);
    }
    expect(iconBlock?.querySelector("svg")).not.toBeNull();
  });

  it("uses the display text-lg reference title typography (CARD-005)", () => {
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    const title = screen.getByText("daily-digest");
    expect(title.tagName).toBe("H3");
    expect(title.classList.contains("text-lg")).toBe(true);
  });

  it("keeps agent, expression, timezone, run information and message (CARD-006)", () => {
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    expect(screen.getByText("digest-agent")).toBeInTheDocument();
    expect(screen.getByText(/0 9 \* \* \*/)).toBeInTheDocument();
    expect(screen.getByText(/utc/i)).toBeInTheDocument();
    expect(screen.getByText(/summarize the daily news/i)).toBeInTheDocument();
  });

  it("keeps the full action set: Disable, Run now, Run History, Edit (CARD-007)", () => {
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    expect(screen.getByRole("button", { name: /^disable$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^run now$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run history/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("renders delete as an icon-only trash button with a target-specific accessible name (CARD-008)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    const deleteButton = screen.getByRole("button", { name: /delete daily-digest/i });
    expect(deleteButton.textContent).not.toMatch(/delete/i);

    await user.click(deleteButton);
    expect(deleteCronMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/confirm delete\?/i)).toBeInTheDocument();
  });

  it("still deletes after explicit confirmation (CARD-008)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CronsPage />, { initialEntries: ["/crons"] });

    await user.click(screen.getByRole("button", { name: /delete daily-digest/i }));
    await user.click(screen.getByText(/confirm delete\?/i));

    expect(deleteCronMutate).toHaveBeenCalledOnce();
  });
});
