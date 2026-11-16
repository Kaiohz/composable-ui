/**
 * Spec: prompts-models-crons-traces.md §PR-004, QA BUG-004
 * usePromptVersion must fetch the FULL immutable content of the selected
 * version from GET /api/v1/prompts/{id}/versions/{version}; the version-LIST
 * endpoint returns summaries only and never carries content.
 *
 * Repo hook-test conventions: the external adapter module is mocked at the
 * network boundary; the hook runs with a real QueryClient.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { usePromptVersion } from "@/application/hooks/prompt/usePromptVersion";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";
import { createPromptVersion } from "../../../fixtures/registries";

vi.mock("@/infrastructure/api/prompt/promptApi", () => ({
  promptApi: {
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

describe("usePromptVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the immutable version content from the detail endpoint", async () => {
    const detail = createPromptVersion({ version: 2, content: "Second revision." });
    vi.mocked(promptApi.getVersion).mockResolvedValue(detail);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePromptVersion("prompt-1", 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(promptApi.getVersion).toHaveBeenCalledWith("prompt-1", 2);
    expect(result.current.data).toEqual(detail);
    expect(result.current.data?.content).toBe("Second revision.");
  });

  it("does not fetch while disabled (no prompt id or no selected version)", () => {
    const { wrapper } = createWrapper();
    renderHook(() => usePromptVersion(null, 2), { wrapper });
    renderHook(() => usePromptVersion("prompt-1", null), { wrapper });

    expect(promptApi.getVersion).not.toHaveBeenCalled();
  });

  it("surfaces fetch errors (not-found / inaccessible)", async () => {
    vi.mocked(promptApi.getVersion).mockRejectedValue(new Error("Prompt not found"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePromptVersion("prompt-404", 9), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Prompt not found");
  });
});
