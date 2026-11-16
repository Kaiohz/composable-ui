/**
 * Spec: prompts-models-crons-traces.md §PR-004, §CACHE-002
 * useCreatePromptVersion must POST the next immutable version and
 * invalidate both the prompt list (latest_version) and that prompt's
 * version history on success.
 *
 * Repo hook-test conventions: the external adapter module is mocked at the
 * network boundary; the hook runs with a real QueryClient.
 *
 * Step-1 (Red): the hook and adapter do not exist yet.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useCreatePromptVersion } from "@/application/hooks/prompt/useCreatePromptVersion";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";
import { createPromptVersion } from "../../../fixtures/registries";

vi.mock("@/infrastructure/api/prompt/promptApi", () => ({
  promptApi: {
    listPrompts: vi.fn(),
    createPrompt: vi.fn(),
    updatePrompt: vi.fn(),
    deletePrompt: vi.fn(),
    listVersions: vi.fn(),
    createVersion: vi.fn(),
    getVersion: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient,
  };
}

describe("useCreatePromptVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts {content} to create the next immutable version", async () => {
    const created = createPromptVersion({ version: 4 });
    vi.mocked(promptApi.createVersion).mockResolvedValue(created);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePromptVersion(), { wrapper });

    act(() => {
      result.current.mutate({ promptId: "prompt-1", content: "New wording" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(promptApi.createVersion).toHaveBeenCalledWith("prompt-1", {
      content: "New wording",
    });
  });

  it("invalidates the prompt list and the affected prompt's version history", async () => {
    const created = createPromptVersion({ version: 4 });
    vi.mocked(promptApi.createVersion).mockResolvedValue(created);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreatePromptVersion(), { wrapper });

    act(() => {
      result.current.mutate({ promptId: "prompt-1", content: "New wording" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["prompts"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["prompt-versions", "prompt-1"],
    });
  });
});
