import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosInstance } from "axios";

const { MockFileConfigRepository } = vi.hoisted(() => {
  const mockConfig = {
    apiBaseUrl: "http://test-api:8010",
    wsBaseUrl: "ws://test-api:8010",
  };
  const mockGetConfig = vi.fn().mockResolvedValue(mockConfig);
  class MockFileConfigRepository {
    getConfig = mockGetConfig;
    isLoaded = vi.fn().mockReturnValue(false);
  }
  return { MockFileConfigRepository };
});

vi.mock("@/infrastructure/config/configRepositoryInstance", () => ({
  configRepository: new MockFileConfigRepository(),
}));

/**
 * Extracts the rejected-handler from an axios response interceptor stack.
 * `handlers` is part of the public `AxiosInterceptorManager` type; the only
 * non-public bit is the handler function shape itself (axios types export
 * the manager, not the handler fn), so it is narrowed structurally.
 */
type RejectedInterceptorHandler = (error: unknown) => Promise<unknown>;

function rejectedHandlerOf(client: AxiosInstance): RejectedInterceptorHandler {
  const handler = client.interceptors.response.handlers?.[0]?.rejected;
  expect(handler).toBeDefined();
  return handler as RejectedInterceptorHandler;
}

describe("axiosInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apiClient fetches config and sets baseURL", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    const requestConfig = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(requestConfig.baseURL).toBe("http://test-api:8010");
  });

  it("apiClient has 30 second timeout", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    expect(apiClient.defaults.timeout).toBe(30000);
  });

  it("apiClient has Content-Type header set to application/json", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    expect(apiClient.defaults.headers["Content-Type"]).toBe("application/json");
  });

  it("error interceptor extracts detail from response", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    const axiosError = {
      response: {
        status: 400,
        data: { detail: "Agent not found" },
      },
      message: "Request failed with status code 400",
    };

    const errorHandler = rejectedHandlerOf(apiClient);

    try {
      await errorHandler(axiosError);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Agent not found");
    }
  });

  it("error interceptor falls back to error.message when detail is absent", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    const axiosError = {
      response: {
        status: 500,
        data: {},
      },
      message: "Internal Server Error",
    };

    const errorHandler = rejectedHandlerOf(apiClient);

    try {
      await errorHandler(axiosError);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Internal Server Error");
    }
  });

  it("error interceptor preserves HTTP status on the rejected Error", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    const axiosError = {
      response: {
        status: 404,
        data: { detail: "File not found: /skills/ghost/SKILL.md" },
      },
      message: "Request failed with status code 404",
    };

    const errorHandler = rejectedHandlerOf(apiClient);

    try {
      await errorHandler(axiosError);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("File not found: /skills/ghost/SKILL.md");
      expect((error as Error & { status?: number }).status).toBe(404);
    }
  });

  it("error interceptor passes through errors without response", async () => {
    const { apiClient } = await import("@/infrastructure/api/axiosInstance");

    const networkError = new Error("Network Error");

    const errorHandler = rejectedHandlerOf(apiClient);

    try {
      await errorHandler(networkError);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Network Error");
    }
  });
});
