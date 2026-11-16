/**
 * Spec: prompts-models-crons-traces.md §PR-004..PR-006 (Prompt UX)
 * Page contract (/prompts):
 *  - List of cards: name, description, latest version, updated timestamp.
 *  - Create/edit metadata via existing dialog/form patterns (name +
 *    description; content only when creating).
 *  - Version history: immutable numeric list + content viewer; adding
 *    content is a distinct "New Version" action.
 *  - Delete with destructive confirmation; a 409 in-use error must be
 *    displayed without closing/losing the current view.
 *  - Loading, empty, error with retry states.
 *
 * Hook contract Step 2 must implement (repo convention: page tests mock the
 * data hooks, mirroring ThreadSidebar/AgentsPage tests):
 *  - @/application/hooks/prompt/usePrompts             → list query {data, isLoading, isError, error, refetch}
 *  - @/application/hooks/prompt/useCreatePrompt        → mutation {name, description?, content}
 *  - @/application/hooks/prompt/useUpdatePrompt        → mutation {id, name?, description?}
 *  - @/application/hooks/prompt/useDeletePrompt        → mutation (id)
 *  - @/application/hooks/prompt/usePromptVersions      → query (promptId | null)
 *  - @/application/hooks/prompt/useCreatePromptVersion → mutation {promptId, content}
 *
 * Step-1 (Red): the page and hooks do not exist yet.
 */
import { screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/render";
import PromptsPage from "@/application/pages/PromptsPage";
import type {
  PromptMetadata,
  PromptVersion,
  PromptVersionSummary,
} from "../../fixtures/registries";
import {
  createPromptMetadata,
  createPromptVersion,
  createPromptVersionSummary,
} from "../../fixtures/registries";

const {
  promptsState,
  versionsState,
  versionDetailState,
  createPromptMutate,
  updatePromptMutate,
  deletePromptMutate,
  createPromptVersionMutate,
} = vi.hoisted(() => {
  return {
    promptsState: {
      data: undefined as PromptMetadata[] | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    versionsState: {
      data: undefined as PromptVersionSummary[] | undefined,
      isLoading: false,
    },
    versionDetailState: {
      promptId: undefined as string | undefined,
      version: null as number | null,
      data: undefined as PromptVersion | undefined,
      isLoading: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    createPromptMutate: vi.fn(),
    updatePromptMutate: vi.fn(),
    deletePromptMutate: vi.fn(),
    createPromptVersionMutate: vi.fn(),
  };
});

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => promptsState,
}));

vi.mock("@/application/hooks/prompt/useCreatePrompt", () => ({
  useCreatePrompt: () => ({ mutate: createPromptMutate, isPending: false }),
}));

vi.mock("@/application/hooks/prompt/useUpdatePrompt", () => ({
  useUpdatePrompt: () => ({ mutate: updatePromptMutate, isPending: false }),
}));

vi.mock("@/application/hooks/prompt/useDeletePrompt", () => ({
  useDeletePrompt: () => ({ mutate: deletePromptMutate, isPending: false }),
}));

vi.mock("@/application/hooks/prompt/usePromptVersions", () => ({
  usePromptVersions: () => versionsState,
}));

vi.mock("@/application/hooks/prompt/usePromptVersion", () => ({
  usePromptVersion: (promptId: string, version: number | null) => {
    versionDetailState.promptId = promptId;
    versionDetailState.version = version;
    return versionDetailState;
  },
}));

vi.mock("@/application/hooks/prompt/useCreatePromptVersion", () => ({
  useCreatePromptVersion: () => ({
    mutate: createPromptVersionMutate,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPromptsPage() {
  return renderWithProviders(<PromptsPage />, { initialEntries: ["/prompts"] });
}

function cardButton(user: ReturnType<typeof userEvent.setup>, name: string, buttonPattern: RegExp) {
  const card = screen.getByText(name).closest("[data-od-id]");
  if (!card) throw new Error(`Prompt card for ${name} not found`);
  return user.click(within(card as HTMLElement).getByRole("button", { name: buttonPattern }));
}

async function openVersionHistory(user: ReturnType<typeof userEvent.setup>, promptName: string) {
  await cardButton(user, promptName, /version history/i);
}

describe("PromptsPage", () => {
  beforeEach(() => {
    createPromptMutate.mockReset();
    updatePromptMutate.mockReset();
    deletePromptMutate.mockReset();
    createPromptVersionMutate.mockReset();
    promptsState.refetch.mockReset();
    promptsState.data = undefined;
    promptsState.isLoading = false;
    promptsState.isError = false;
    promptsState.error = undefined;
    versionsState.data = undefined;
    versionsState.isLoading = false;
    versionDetailState.promptId = undefined;
    versionDetailState.version = null;
    versionDetailState.data = undefined;
    versionDetailState.isLoading = false;
    versionDetailState.isError = false;
    versionDetailState.error = undefined;
    versionDetailState.refetch.mockReset();
  });

  it("lists prompts with name, description, latest version and updated timestamp", () => {
    promptsState.data = [
      createPromptMetadata({
        name: "support-triage",
        description: "Routes support tickets",
        latest_version: 3,
        updated_at: "2026-11-10T10:00:00Z",
      }),
    ];

    renderPromptsPage();

    expect(screen.getByText("support-triage")).toBeInTheDocument();
    expect(screen.getByText(/routes support tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/version 3|v3\b/i)).toBeInTheDocument();
    // Updated timestamp must be human-readable (month + day minimum).
    expect(screen.getByText(/nov(ember)?\s*10/i)).toBeInTheDocument();
  });

  it("shows a loading state while prompts load", () => {
    promptsState.isLoading = true;

    renderPromptsPage();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows an empty state when no prompts exist", () => {
    promptsState.data = [];

    renderPromptsPage();

    expect(screen.getByText(/no prompts/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when listing fails", async () => {
    promptsState.isError = true;
    promptsState.error = new Error("Network down");
    const user = userEvent.setup();

    renderPromptsPage();

    expect(screen.getByText(/network down/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(promptsState.refetch).toHaveBeenCalled();
  });

  it("creates a prompt from name, description and initial content", async () => {
    promptsState.data = [];
    const user = userEvent.setup();

    renderPromptsPage();
    await user.click(screen.getByRole("button", { name: /new prompt/i }));

    await user.type(screen.getByLabelText(/^name$/i), "release-notes");
    await user.type(screen.getByLabelText(/^description$/i), "Writes release notes");
    await user.type(screen.getByLabelText(/^content$/i), "You are a release notes writer.");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createPromptMutate).toHaveBeenCalledWith(
      {
        name: "release-notes",
        description: "Writes release notes",
        content: "You are a release notes writer.",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("requires content when creating a prompt and blocks submit otherwise", async () => {
    promptsState.data = [];
    const user = userEvent.setup();

    renderPromptsPage();
    await user.click(screen.getByRole("button", { name: /new prompt/i }));

    await user.type(screen.getByLabelText(/^name$/i), "release-notes");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createPromptMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/content is required/i)).toBeInTheDocument();
  });

  it("edits metadata only — the update mutation must not carry content", async () => {
    promptsState.data = [createPromptMetadata({ id: "prompt-1", name: "support-triage" })];
    const user = userEvent.setup();

    renderPromptsPage();
    await cardButton(user, "support-triage", /^edit$/i);

    const descriptionField = screen.getByLabelText(/^description$/i);
    await user.clear(descriptionField);
    await user.type(descriptionField, "Updated routing prompt");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updatePromptMutate).toHaveBeenCalledWith(
      {
        id: "prompt-1",
        name: "support-triage",
        description: "Updated routing prompt",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const payload = updatePromptMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("content");
  });

  it("shows version history in numeric order and fetches the selected version content from the detail endpoint", async () => {
    promptsState.data = [createPromptMetadata({ latest_version: 3 })];
    versionsState.data = [
      createPromptVersionSummary({ version: 1 }),
      createPromptVersionSummary({ version: 2, created_at: "2026-11-02T10:00:00Z" }),
      createPromptVersionSummary({ version: 3, created_at: "2026-11-03T10:00:00Z" }),
    ];
    versionDetailState.data = createPromptVersion({
      version: 2,
      content: "Second revision.",
      created_at: "2026-11-02T10:00:00Z",
    });
    const user = userEvent.setup();

    renderPromptsPage();
    await openVersionHistory(user, "support-triage");

    const versionOrder = screen
      .getAllByRole("button", { name: /^v\d+/i })
      .map((btn) => Number(btn.textContent?.match(/v(\d+)/i)?.[1]));
    expect(versionOrder).toEqual([...versionOrder].sort((a, b) => a - b));

    await user.click(screen.getByRole("button", { name: /^v2$/ }));

    // The immutable content is fetched from GET /versions/{version} and
    // rendered from the DETAIL payload, not from the summary list (QA BUG-004).
    await waitFor(() => {
      expect(versionDetailState.version).toBe(2);
    });
    expect(versionDetailState.promptId).toBe("11111111-1111-4111-8111-111111111111");
    expect(screen.getByText(/second revision\./i)).toBeInTheDocument();
  });

  it("shows a loading state while the selected version content is fetched", async () => {
    promptsState.data = [createPromptMetadata({ latest_version: 2 })];
    versionsState.data = [createPromptVersionSummary({ version: 1 })];
    versionDetailState.isLoading = true;
    const user = userEvent.setup();

    renderPromptsPage();
    await openVersionHistory(user, "support-triage");

    await waitFor(() => {
      expect(screen.getByText(/loading content/i)).toBeInTheDocument();
    });
  });

  it("shows an explicit error with retry when the version content fetch fails", async () => {
    promptsState.data = [createPromptMetadata({ latest_version: 2 })];
    versionsState.data = [createPromptVersionSummary({ version: 1 })];
    versionDetailState.isError = true;
    versionDetailState.error = new Error("Version not found");
    const user = userEvent.setup();

    renderPromptsPage();
    await openVersionHistory(user, "support-triage");

    await waitFor(() => {
      expect(screen.getByText(/version not found/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(versionDetailState.refetch).toHaveBeenCalled();
  });

  it("version history is immutable — no edit/delete controls for existing versions", async () => {
    promptsState.data = [createPromptMetadata()];
    versionsState.data = [createPromptVersionSummary({ version: 1 })];
    versionDetailState.data = createPromptVersion({ version: 1 });
    const user = userEvent.setup();

    renderPromptsPage();
    await openVersionHistory(user, "support-triage");

    expect(screen.queryByRole("button", { name: /edit version/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete version/i })).not.toBeInTheDocument();
  });

  it("adds a new immutable version via the New Version action", async () => {
    promptsState.data = [createPromptMetadata()];
    versionsState.data = [
      createPromptVersionSummary({ version: 1 }),
      createPromptVersionSummary({ version: 2 }),
    ];
    const user = userEvent.setup();

    renderPromptsPage();
    await openVersionHistory(user, "support-triage");

    await user.click(screen.getByRole("button", { name: /new version/i }));
    await user.type(screen.getByLabelText(/^content$/i), "Latest prompt wording.");
    await user.click(screen.getByRole("button", { name: /^add version$/i }));

    expect(createPromptVersionMutate).toHaveBeenCalledWith(
      {
        promptId: "11111111-1111-4111-8111-111111111111",
        content: "Latest prompt wording.",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("deletes an unreferenced prompt after destructive confirmation", async () => {
    promptsState.data = [createPromptMetadata({ id: "prompt-9", name: "draft-scratch" })];
    const user = userEvent.setup();

    renderPromptsPage();
    await cardButton(user, "draft-scratch", /^delete$/i);
    // Destructive confirmation (existing confirm-delete pattern).
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(deletePromptMutate).toHaveBeenCalledWith(
      "prompt-9",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("surfaces an in-use (409) error without closing or losing the current view", async () => {
    promptsState.data = [
      createPromptMetadata({ id: "prompt-9", name: "support-triage" }),
      createPromptMetadata({ id: "prompt-other", name: "release-notes", latest_version: 1 }),
    ];
    versionsState.data = [createPromptVersionSummary({ version: 1 })];
    versionDetailState.data = createPromptVersion({ version: 1 });
    const user = userEvent.setup();

    renderPromptsPage();
    await openVersionHistory(user, "support-triage");

    // BUG-003 corrected behavior: an open modal must NOT mutate the list
    // behind it — the sibling card's actions stay rendered and reachable.
    const siblingCard = document.querySelectorAll('[data-od-id="prompt-card"]')[1] as HTMLElement;
    expect(within(siblingCard).getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(
      within(siblingCard).getByRole("button", { name: /version history/i }),
    ).toBeInTheDocument();
    expect(within(siblingCard).getByRole("button", { name: /^delete$/i })).toBeInTheDocument();

    // Delete from within the open version-history view — the query is
    // scoped to the dialog container (card actions are on screen again).
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await user.click(within(dialog).getByRole("button", { name: /confirm delete/i }));

    // Step 2 must expose mutation callbacks; simulate the 409 outcome.
    const options = deletePromptMutate.mock.calls[0][1] as {
      onError: (e: Error) => void;
    };
    options.onError(new Error("Prompt is referenced by agents"));

    expect(screen.getByText(/referenced by agents|in use/i)).toBeInTheDocument();
  });

  it("permits duplicate display names and distinguishes records by version metadata", () => {
    promptsState.data = [
      createPromptMetadata({
        id: "prompt-a",
        name: "summarizer",
        latest_version: 1,
        description: "Short summaries",
      }),
      createPromptMetadata({
        id: "prompt-b",
        name: "summarizer",
        latest_version: 4,
        description: null,
      }),
    ];

    renderPromptsPage();

    expect(screen.getAllByText("summarizer")).toHaveLength(2);
    expect(screen.getByText(/version 1|v1\b/i)).toBeInTheDocument();
    expect(screen.getByText(/version 4|v4\b/i)).toBeInTheDocument();
  });
});
