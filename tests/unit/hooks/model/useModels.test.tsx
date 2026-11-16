/**
 * Spec: prompts-models-crons-traces.md §MDL-003/MDL-004, §CACHE-002
 * Model hooks must expose the user's metadata-only catalog and invalidate
 * the catalog list after create/update/delete.
 *
 * Repo hook-test conventions: the external adapter module is mocked at the
 * network boundary; hooks run with a real QueryClient.
 *
 * Step-1 (Red): the hooks and adapter do not exist yet.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useModels } from "@/application/hooks/model/useModels";
import { useCreateModel } from "@/application/hooks/model/useCreateModel";
import { modelApi } from "@/infrastructure/api/model/modelApi";
import { createModelConfiguration } from "../../../fixtures/registries";

vi.mock("@/infrastructure/api/model/modelApi", () => ({
  modelApi: {
    listModels: vi.fn(),
    createModel: vi.fn(),
    updateModel: vi.fn(),
    deleteModel: vi.fn(),
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

describe("model hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useModels lists the user's catalog from GET /api/v1/models", async () => {
    const catalog = [createModelConfiguration()];
    vi.mocked(modelApi.listModels).mockResolvedValue(catalog);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useModels(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(modelApi.listModels).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(catalog);
  });

  it("useCreateModel posts the metadata-only payload and invalidates the catalog", async () => {
    const created = createModelConfiguration();
    vi.mocked(modelApi.createModel).mockResolvedValue(created);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateModel(), { wrapper });

    act(() => {
      result.current.mutate({
        name: "Fast Haiku",
        provider: "openai",
        provider_model: "anthropic/claude-haiku-4.5",
        base_url: null,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(modelApi.createModel).toHaveBeenCalledWith({
      name: "Fast Haiku",
      provider: "openai",
      provider_model: "anthropic/claude-haiku-4.5",
      base_url: null,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["models"] });
  });
});
