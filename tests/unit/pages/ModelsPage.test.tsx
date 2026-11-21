/**
 * Spec: prompts-models-crons-traces.md §MDL-001..MDL-004 (Model UX)
 * Page contract (/models):
 *  - Metadata-only CRUD: cards list name, provider, provider model
 *    identifier, optional base URL, updated timestamp.
 *  - Forms contain ONLY the MDL-001 metadata fields — no API key, token,
 *    credential, masking, reveal, or credential-management UI of any kind.
 *  - Delete with confirmation; a 409 in-use conflict is surfaced.
 *  - Loading, empty, error with retry states.
 *
 * Hook contract Step 2 must implement (repo page-test convention):
 *  - @/application/hooks/model/useModels        → list query
 *  - @/application/hooks/model/useCreateModel   → mutation {name, provider, provider_model, base_url?}
 *  - @/application/hooks/model/useUpdateModel   → mutation {id, name?, provider?, provider_model?, base_url?}
 *  - @/application/hooks/model/useDeleteModel   → mutation (id)
 *
 * Step-1 (Red): the page and hooks do not exist yet.
 */
import { screen } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import ModelsPage from "@/application/pages/ModelsPage";
import type { ModelConfiguration } from "../../fixtures/registries";
import { createModelConfiguration } from "../../fixtures/registries";

const { modelsState, createModelMutate, updateModelMutate, deleteModelMutate } = vi.hoisted(() => ({
  modelsState: {
    data: undefined as ModelConfiguration[] | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  createModelMutate: vi.fn(),
  updateModelMutate: vi.fn(),
  deleteModelMutate: vi.fn(),
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => modelsState,
}));

vi.mock("@/application/hooks/model/useCreateModel", () => ({
  useCreateModel: () => ({ mutate: createModelMutate, isPending: false }),
}));

vi.mock("@/application/hooks/model/useUpdateModel", () => ({
  useUpdateModel: () => ({ mutate: updateModelMutate, isPending: false }),
}));

vi.mock("@/application/hooks/model/useDeleteModel", () => ({
  useDeleteModel: () => ({ mutate: deleteModelMutate, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function cardButton(user: ReturnType<typeof userEvent.setup>, name: string, buttonPattern: RegExp) {
  const card = screen.getByText(name).closest("[data-od-id]");
  if (!card) throw new Error(`Model card for ${name} not found`);
  return user.click(within(card as HTMLElement).getByRole("button", { name: buttonPattern }));
}

describe("ModelsPage", () => {
  beforeEach(() => {
    createModelMutate.mockReset();
    updateModelMutate.mockReset();
    deleteModelMutate.mockReset();
    modelsState.refetch.mockReset();
    modelsState.data = undefined;
    modelsState.isLoading = false;
    modelsState.isError = false;
    modelsState.error = undefined;
  });

  it("lists models with name, provider, provider model and base URL", () => {
    modelsState.data = [
      createModelConfiguration({
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: "https://api.example.com/v1",
      }),
    ];

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    expect(screen.getByText("Fast Haiku")).toBeInTheDocument();
    expect(screen.getByText(/openai/i)).toBeInTheDocument();
    expect(screen.getByText(/anthropic\/claude-haiku-4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/api\.example\.com\/v1/)).toBeInTheDocument();
  });

  it("shows a loading state while models load", () => {
    modelsState.isLoading = true;

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows an empty state when no models exist", () => {
    modelsState.data = [];

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    expect(screen.getByText(/no models/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when listing fails", async () => {
    modelsState.isError = true;
    modelsState.error = new Error("Request failed");

    const user = userEvent.setup();
    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(modelsState.refetch).toHaveBeenCalled();
  });

  it("creates a metadata-only model configuration", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    await user.type(screen.getByLabelText(/^name$/i), "Fast Haiku");
    await user.type(screen.getByLabelText(/^provider$/i), "openai");
    await user.type(screen.getByLabelText(/provider model/i), "anthropic/claude-haiku-4.5");
    await user.type(screen.getByLabelText(/base url/i), "https://api.example.com/v1");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createModelMutate).toHaveBeenCalledWith(
      {
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: "https://api.example.com/v1",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("forms contain no credential-management UI (MDL-001 metadata only)", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    // No credential fields of any kind.
    expect(
      screen.queryByLabelText(/api key|api-key|credential|token|secret|password/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /api key|token|secret/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();

    // And no show/reveal/clear credential actions.
    expect(
      screen.queryByRole("button", {
        name: /reveal|copy key|clear key|mask/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("edits provider metadata while preserving the existing base URL", async () => {
    modelsState.data = [
      createModelConfiguration({
        id: "model-1",
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: "https://api.example.com/v1",
      }),
    ];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await cardButton(user, "Fast Haiku", /^edit$/i);

    const providerField = screen.getByLabelText(/^provider$/i);
    await user.clear(providerField);
    await user.type(providerField, "anthropic");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // Editing other metadata must NOT delete the stored base URL (MDL-003):
    // the backend treats PATCH base_url null as "clear it" (QA BUG-009).
    expect(updateModelMutate).toHaveBeenCalledWith(
      {
        id: "model-1",
        name: "Fast Haiku",
        provider: "anthropic",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: "https://api.example.com/v1",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("sends base_url null only when the operator explicitly clears the field", async () => {
    modelsState.data = [
      createModelConfiguration({
        id: "model-1",
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: "https://api.example.com/v1",
      }),
    ];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await cardButton(user, "Fast Haiku", /^edit$/i);

    await user.clear(screen.getByLabelText(/^base url$/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateModelMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "model-1", base_url: null }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("deletes an unreferenced model after destructive confirmation", async () => {
    modelsState.data = [createModelConfiguration({ id: "model-9", name: "Legacy GPT" })];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await cardButton(user, "Legacy GPT", /^delete legacy gpt$/i);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(deleteModelMutate).toHaveBeenCalledWith(
      "model-9",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("surfaces an in-use (409) delete conflict without closing the dialog", async () => {
    modelsState.data = [createModelConfiguration({ id: "model-9", name: "Fast Haiku" })];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await cardButton(user, "Fast Haiku", /^delete fast haiku$/i);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    const options = deleteModelMutate.mock.calls[0][1] as {
      onError: (e: Error) => void;
    };
    options.onError(new Error("Model is referenced by agents"));

    expect(screen.getByText(/referenced by agents|in use/i)).toBeInTheDocument();
  });

  it("provider, provider model identifier and name are required", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createModelMutate).not.toHaveBeenCalled();
    expect(screen.getAllByText(/required/i).length).toBeGreaterThanOrEqual(1);
  });
});
