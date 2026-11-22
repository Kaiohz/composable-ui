/**
 * Model page contract (model-catalog-settings-only.md §E, UI-001..UI-002,
 * UI-006): the create/edit form shows ONLY `Name` and `Provider model`, both
 * required, and mutations send ONLY those fields — never `provider`,
 * `base_url`, nor even `null` placeholders for them. Delete with
 * confirmation and the 409 in-use conflict remain. Loading, empty and error
 * states remain.
 *
 * The Settings page and its LLM Settings fixtures are NOT covered here and
 * remain untouched (UI-007).
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

  it("lists models with name and provider model only (no Provider, no Base URL)", () => {
    modelsState.data = [createModelConfiguration()];

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });

    expect(screen.getByText("Fast Haiku")).toBeInTheDocument();
    expect(screen.getByText(/anthropic\/claude-haiku-4\.5/)).toBeInTheDocument();
    // UI-005: the removed connection surface must be gone entirely.
    expect(screen.queryByText(/openai/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/api\.example\.com/)).not.toBeInTheDocument();
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

  it("create form renders only Name and Provider model (UI-001)", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provider model/i)).toBeInTheDocument();
    // The connection fields belong to user LLM Settings only — no Model form
    // field for provider or base URL remains, not even optional.
    expect(screen.queryByLabelText(/^provider$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/base url/i)).not.toBeInTheDocument();
  });

  it("create sends only name and provider_model (UI-002)", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    await user.type(screen.getByLabelText(/^name$/i), "GLM 5.3 Flash");
    await user.type(screen.getByLabelText(/provider model/i), "z-ai/glm-5.3-flash:nitro");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createModelMutate).toHaveBeenCalledWith(
      { name: "GLM 5.3 Flash", provider_model: "z-ai/glm-5.3-flash:nitro" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const payload = createModelMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("provider");
    expect(payload).not.toHaveProperty("base_url"); // not even `null`
  });

  it("edit form renders only Name and Provider model, prefilled", async () => {
    modelsState.data = [
      createModelConfiguration({
        id: "model-1",
        name: "Fast Haiku",
        provider_model: "anthropic/claude-haiku-4.5",
      }),
    ];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await cardButton(user, "Fast Haiku", /^edit$/i);

    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Fast Haiku");
    expect(screen.getByLabelText(/provider model/i)).toHaveValue("anthropic/claude-haiku-4.5");
    expect(screen.queryByLabelText(/^provider$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/base url/i)).not.toBeInTheDocument();
  });

  it("edit sends only name and provider_model (UI-002)", async () => {
    modelsState.data = [
      createModelConfiguration({
        id: "model-1",
        name: "Fast Haiku",
        provider_model: "anthropic/claude-haiku-4.5",
      }),
    ];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await cardButton(user, "Fast Haiku", /^edit$/i);

    const nameField = screen.getByLabelText(/^name$/i);
    await user.clear(nameField);
    await user.type(nameField, "Edited Haiku");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateModelMutate).toHaveBeenCalledWith(
      { id: "model-1", name: "Edited Haiku", provider_model: "anthropic/claude-haiku-4.5" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const payload = updateModelMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("provider");
    expect(payload).not.toHaveProperty("base_url");
  });

  it("forms contain no credential-management UI (MDL-002/009 regression)", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    expect(
      screen.queryByLabelText(/api key|api-key|credential|token|secret|password/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /api key|token|secret/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(
      screen.queryByRole("button", { name: /reveal|copy key|clear key|mask/i }),
    ).not.toBeInTheDocument();
  });

  it("deletes an unreferenced model after destructive confirmation (UI-006)", async () => {
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

  it("surfaces an in-use (409) delete conflict without closing the dialog (UI-006)", async () => {
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

  it("name and provider model are both required (UI-001)", async () => {
    modelsState.data = [];
    const user = userEvent.setup();

    renderWithProviders(<ModelsPage />, { initialEntries: ["/models"] });
    await user.click(screen.getByRole("button", { name: /new model/i }));

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createModelMutate).not.toHaveBeenCalled();
    expect(screen.getAllByText(/required/i).length).toBeGreaterThanOrEqual(1);
  });
});
