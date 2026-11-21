/**
 * Spec: unify-cards-modals.md — Shared resource cards
 * (CARD-003, CARD-004, CARD-005, CARD-006, CARD-007, CARD-008, CARD-009, CARD-012).
 *
 * Model cards rendered through the real /models page must use the
 * Agent-reference card visual language and the standard responsive resource
 * grid, while keeping every existing data point, action and stable
 * `data-od-id`.
 *
 * Step-1 (Red): ModelCard is still a flat `border bg-surface p-4` card with
 * a text button footer inside a `gap-4 xl:grid-cols-3` grid.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import ModelsPage from "@/application/pages/ModelsPage";
import type { ModelConfiguration } from "../../fixtures/registries";
import { createModelConfiguration } from "../../fixtures/registries";

const { modelsState, deleteModelMutate } = vi.hoisted(() => ({
  modelsState: {
    data: undefined as ModelConfiguration[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  deleteModelMutate: vi.fn(),
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => modelsState,
}));

vi.mock("@/application/hooks/model/useCreateModel", () => ({
  useCreateModel: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/model/useUpdateModel", () => ({
  useUpdateModel: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/model/useDeleteModel", () => ({
  useDeleteModel: () => ({ mutate: deleteModelMutate, isPending: false }),
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

function modelCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-od-id="model-card"]');
  if (!card) throw new Error("Model card not found");
  return card;
}

describe("ModelsPage unified resource card", () => {
  beforeEach(() => {
    deleteModelMutate.mockReset();
    modelsState.data = [
      createModelConfiguration({
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: "https://api.example.com/v1",
      }),
    ];
    modelsState.isLoading = false;
    modelsState.isError = false;
    modelsState.error = undefined;
  });

  it("applies the Agent-reference raised/hover card treatment (CARD-003)", () => {
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    const card = modelCard();
    for (const token of REFERENCE_CONTAINER_TOKENS) {
      expect(card.classList.contains(token)).toBe(true);
    }
  });

  it("renders the square Agent-reference icon block with a Lucide icon (CARD-004)", () => {
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    const card = modelCard();
    const iconBlock = card.querySelector("div[class*='h-12'][class*='w-12']");
    expect(iconBlock).not.toBeNull();
    for (const token of REFERENCE_ICON_BLOCK_TOKENS) {
      expect(iconBlock?.classList.contains(token)).toBe(true);
    }
    expect(iconBlock?.querySelector("svg")).not.toBeNull();
  });

  it("uses the display text-lg reference title typography (CARD-005)", () => {
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    const title = screen.getByText("Fast Haiku");
    expect(title.tagName).toBe("H3");
    expect(title.classList.contains("text-lg")).toBe(true);
  });

  it("keeps provider, provider model, base URL and id metadata (CARD-006, CARD-012)", () => {
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    expect(screen.getByText(/anthropic\/claude-haiku-4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/api\.example\.com\/v1/)).toBeInTheDocument();
    expect(screen.getByText(/22222222/)).toBeInTheDocument();
    // Provider badge stays visible and non-shrinking.
    const badge = document.querySelector<HTMLElement>('[data-od-id="model-provider"]');
    expect(badge?.classList.contains("shrink-0")).toBe(true);
  });

  it("places the actions in the top-separated reference footer (CARD-007)", () => {
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    const card = modelCard();
    const footer = Array.from(card.children).find((child) => child.classList.contains("mt-auto"));
    expect(footer).toBeDefined();
    const tokens = ["mt-auto", "border-t", "border-border-soft", "pt-2"];
    for (const token of tokens) {
      expect(footer?.classList.contains(token)).toBe(true);
    }
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("renders delete as an icon-only trash button with a target-specific accessible name (CARD-008)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    const deleteButton = screen.getByRole("button", { name: /delete fast haiku/i });
    expect(deleteButton.textContent).not.toMatch(/delete/i);

    await user.click(deleteButton);
    expect(deleteModelMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/confirm delete\?/i)).toBeInTheDocument();
  });

  it("still deletes after explicit confirmation (CARD-008)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    await user.click(screen.getByRole("button", { name: /delete fast haiku/i }));
    await user.click(screen.getByText(/confirm delete\?/i));

    expect(deleteModelMutate).toHaveBeenCalledOnce();
  });

  it("uses the standard responsive resource grid (CARD-009)", () => {
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    const grid = document.querySelector<HTMLElement>('[data-od-id="models-list"]');
    expect(grid).not.toBeNull();
    const tokens = ["grid", "grid-cols-1", "gap-6", "md:grid-cols-2", "lg:grid-cols-3"];
    for (const token of tokens) {
      expect(grid?.classList.contains(token)).toBe(true);
    }
  });
});
