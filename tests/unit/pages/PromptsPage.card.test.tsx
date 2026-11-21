/**
 * Spec: unify-cards-modals.md — Shared resource cards
 * (CARD-003, CARD-004, CARD-005, CARD-006, CARD-007, CARD-008, CARD-009, CARD-012).
 *
 * Prompt cards rendered through the real /prompts page must use the
 * Agent-reference card visual language (raised shadow, hover lift, square
 * icon block, display-lg title, separated footer) and the standard
 * responsive resource grid, while keeping every existing data point,
 * action and stable `data-od-id`.
 *
 * Step-1 (Red): PromptCard is still a flat `border bg-surface p-4` card
 * with a text button footer inside a `gap-4 xl:grid-cols-3` grid.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import PromptsPage from "@/application/pages/PromptsPage";
import type { PromptMetadata } from "../../fixtures/registries";
import { createPromptMetadata } from "../../fixtures/registries";

const { promptsState, deletePromptMutate } = vi.hoisted(() => ({
  promptsState: {
    data: undefined as PromptMetadata[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  deletePromptMutate: vi.fn(),
}));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => promptsState,
}));

vi.mock("@/application/hooks/prompt/useCreatePrompt", () => ({
  useCreatePrompt: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/prompt/useUpdatePrompt", () => ({
  useUpdatePrompt: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/prompt/useDeletePrompt", () => ({
  useDeletePrompt: () => ({ mutate: deletePromptMutate, isPending: false }),
}));

vi.mock("@/application/hooks/prompt/usePromptVersions", () => ({
  usePromptVersions: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/application/hooks/prompt/usePromptVersion", () => ({
  usePromptVersion: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/application/hooks/prompt/useCreatePromptVersion", () => ({
  useCreatePromptVersion: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** Reference tokens from the AgentCard visual language (spec §Reference visual language). */
const REFERENCE_CONTAINER_TOKENS = [
  "block-shadow-raised",
  "hover:-translate-y-0.5",
  "hover:border-accent",
] as const;

const REFERENCE_ICON_BLOCK_TOKENS = ["h-12", "w-12", "bg-surface-warm", "text-accent"] as const;

const REFERENCE_FOOTER_TOKENS = ["mt-auto", "border-t", "border-border-soft", "pt-2"] as const;

function promptCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-od-id="prompt-card"]');
  if (!card) throw new Error("Prompt card not found");
  return card;
}

describe("PromptsPage unified resource card", () => {
  beforeEach(() => {
    deletePromptMutate.mockReset();
    promptsState.data = [createPromptMetadata()];
    promptsState.isLoading = false;
    promptsState.isError = false;
    promptsState.error = undefined;
  });

  it("applies the Agent-reference raised/hover card treatment (CARD-003)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    const card = promptCard();
    for (const token of REFERENCE_CONTAINER_TOKENS) {
      expect(card.classList.contains(token)).toBe(true);
    }
  });

  it("renders the square Agent-reference icon block with a Lucide icon (CARD-004)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    const card = promptCard();
    const iconBlock = card.querySelector("div[class*='h-12'][class*='w-12']");
    expect(iconBlock).not.toBeNull();
    for (const token of REFERENCE_ICON_BLOCK_TOKENS) {
      expect(iconBlock?.classList.contains(token)).toBe(true);
    }
    expect(iconBlock?.querySelector("svg")).not.toBeNull();
  });

  it("uses the display text-lg reference title typography (CARD-005)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    const title = screen.getByText("support-triage");
    expect(title.tagName).toBe("H3");
    expect(title.classList.contains("text-lg")).toBe(true);
    expect(title.classList.contains("truncate")).toBe(true);
  });

  it("keeps the prompt name, version badge, description and id metadata (CARD-006, CARD-012)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    expect(screen.getByText("support-triage")).toBeInTheDocument();
    expect(screen.getByText(/routes support tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/version 2|v2\b/i)).toBeInTheDocument();
    expect(screen.getByText(/11111111/)).toBeInTheDocument();
  });

  it("places the actions in the top-separated reference footer (CARD-007)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    const card = promptCard();
    const footer = Array.from(card.children).find((child) => child.classList.contains("mt-auto"));
    expect(footer).toBeDefined();
    for (const token of REFERENCE_FOOTER_TOKENS) {
      expect(footer?.classList.contains(token)).toBe(true);
    }
  });

  it("keeps Edit and Version History actions (CARD-007)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /version history/i })).toBeInTheDocument();
  });

  it("renders delete as an icon-only trash button with a target-specific accessible name (CARD-008)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    const deleteButton = screen.getByRole("button", { name: /delete support-triage/i });
    // Icon-only treatment: the accessible name comes from the aria-label,
    // not from a visible "Delete" text label.
    expect(deleteButton.textContent).not.toMatch(/delete/i);

    // First click arms the two-step confirmation without deleting.
    await user.click(deleteButton);
    expect(deletePromptMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/confirm delete\?/i)).toBeInTheDocument();
  });

  it("still deletes after explicit confirmation (CARD-008)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    await user.click(screen.getByRole("button", { name: /delete support-triage/i }));
    await user.click(screen.getByText(/confirm delete\?/i));

    expect(deletePromptMutate).toHaveBeenCalledOnce();
  });

  it("uses the standard responsive resource grid (CARD-009)", () => {
    renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });

    const grid = document.querySelector<HTMLElement>('[data-od-id="prompts-list"]');
    expect(grid).not.toBeNull();
    const tokens = ["grid", "grid-cols-1", "gap-6", "md:grid-cols-2", "lg:grid-cols-3"];
    for (const token of tokens) {
      expect(grid?.classList.contains(token)).toBe(true);
    }
  });
});
