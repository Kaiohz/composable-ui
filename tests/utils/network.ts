import { vi } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import { ragApiClient } from "@/infrastructure/api/ragAxiosInstance";

/**
 * Network-boundary stub for the two REAL axios clients used by composable-ui:
 *
 * - "api"  → `apiClient` (composable-agents backend: /api/v1/…),
 * - "rag"  → `ragApiClient` (mcp-raganything backend: /api/v1/files|classical|spaces/…).
 *
 * The routes are answered by a routing custom adapter installed on
 * `defaults.adapter` — the same repo convention as the McpRegistryPage
 * behavioral tests. The REAL hooks, api layers, domain entities and page
 * components therefore run unchanged; only the network responses are scripted.
 *
 * Behavior contract:
 * - Unhandled routes (method + path with no matching route) fail loudly with
 *   a 500-shaped error carrying an explicit message, so a broken test setup
 *   can never silently look like a passing feature.
 * - Non-2xx responders reject with a `{ status, response: { status, data } }`
 *   error — identical to what the axios transport produces — so callers
 *   (e.g. `isNotFound` on 404) behave exactly like production.
 * - Every request (both clients) is captured in arrival order for wiring
 *   assertions (URL, query, body).
 */

export type ClientName = "api" | "rag";

export interface RouteContext {
  /** Upper-cased HTTP method (e.g. "GET"). */
  readonly method: string;
  /** URL path without the query string (e.g. "/api/v1/files/list"). */
  readonly path: string;
  /** Query params merged from axios `params` and any literal `?a=b` in the URL. */
  readonly query: Record<string, string>;
  /**
   * Request headers, keys lower-cased (HTTP semantics). Carries the caller
   * scope: `x-composable-agent` selects the space on RAG requests (REQ-001).
   */
  readonly headers: Record<string, string>;
  /** Request body (plain object for JSON, FormData for multipart, string otherwise). */
  readonly body: unknown;
}

export interface RouteResponse {
  readonly status: number;
  readonly data: unknown;
}

export interface NetworkRoute {
  readonly client: ClientName;
  readonly method: string;
  /** Path regex (e.g. /\/api\/v1\/spaces$/). */
  readonly match: RegExp;
  /** May return a promise to hold the request in-loading (slow-loading tests). */
  readonly respond: (ctx: RouteContext) => RouteResponse | Promise<RouteResponse>;
}

export interface CapturedRequest {
  readonly client: ClientName;
  readonly method: string;
  readonly path: string;
  readonly query: Record<string, string>;
  /** Request headers, keys lower-cased (see {@link RouteContext.headers}). */
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** Normalizes axios request headers into a plain lower-cased string map. */
function normalizeHeaders(headers: unknown): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return normalized;
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return normalized;
}

export interface StubbedNetwork {
  /** All captured requests across both clients, in arrival order. */
  readonly requests: readonly CapturedRequest[];
  /** Routes that matched no handler (never empty when a test 500s unexpectedly). */
  readonly unhandled: readonly string[];
  restore: () => void;
}

/**
 * Fetch("/config.json") payload — identical in every test file (the config
 * repository is a module singleton that caches the parsed config for the
 * lifetime of the test file, so all stubs in one file must agree).
 */
export const TEST_APP_CONFIG = {
  apiBaseUrl: "http://api.test.com",
  wsBaseUrl: "ws://api.test.com",
  ragApiBaseUrl: "https://ragany.test.com",
  mcpApiBaseUrl: "",
  oauth2ProxyUrl: "",
  logtoUrl: "",
  logtoAppId: "",
  builtInMcpServers: [],
};

/** Route builder for brevity. */
export function route(
  client: ClientName,
  method: string,
  match: RegExp,
  respond: (ctx: RouteContext) => RouteResponse | Promise<RouteResponse>,
): NetworkRoute {
  return { client, method, match, respond };
}

const activeStubs: StubbedNetwork[] = [];

/**
 * Installs the network stub on both real axios clients + fetch("/config.json").
 * Pair with `restoreAllNetworks()` in `afterEach`.
 */
export function stubNetwork(routes: NetworkRoute[] = []): StubbedNetwork {
  const requests: CapturedRequest[] = [];
  const unhandled: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => TEST_APP_CONFIG })),
  );

  const makeAdapter = (client: ClientName) => {
    return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const method = (config.method ?? "get").toUpperCase();
      const rawUrl = String(config.url ?? "");
      const query: Record<string, string> = {};
      const queryIndex = rawUrl.indexOf("?");
      let path = rawUrl;
      if (queryIndex >= 0) {
        path = rawUrl.slice(0, queryIndex);
        for (const [key, value] of new URLSearchParams(rawUrl.slice(queryIndex + 1))) {
          query[key] = value;
        }
      }
      const axiosParams = (config.params ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(axiosParams)) {
        if (value !== undefined) query[key] = String(value);
      }
      const headers = normalizeHeaders(config.headers);

      requests.push({ client, method, path, query, headers, body: config.data });

      const matched = routes.find(
        (r) => r.client === client && r.method === method && r.match.test(path),
      );
      if (!matched) {
        const message = `Test network stub has no route for: ${method} ${path} [${client}]`;
        unhandled.push(message);
        throw httpError(config, 500, { detail: message });
      }
      const { status, data } = await matched.respond({
        method,
        path,
        query,
        headers,
        body: config.data,
      });
      if (status >= 400) throw httpError(config, status, data);
      return { data, status, statusText: "OK", headers: {}, config } as AxiosResponse;
    };
  };

  const originalApiAdapter = apiClient.defaults.adapter;
  const originalRagAdapter = ragApiClient.defaults.adapter;
  apiClient.defaults.adapter = makeAdapter("api");
  ragApiClient.defaults.adapter = makeAdapter("rag");

  const handle: StubbedNetwork = {
    requests,
    unhandled,
    restore: () => {
      apiClient.defaults.adapter = originalApiAdapter;
      ragApiClient.defaults.adapter = originalRagAdapter;
      vi.unstubAllGlobals();
    },
  };
  activeStubs.push(handle);
  return handle;
}

/** afterEach hook for every file that called `stubNetwork`. */
export function restoreAllNetworks(): void {
  for (const stub of activeStubs.splice(0)) {
    stub.restore();
  }
}

function httpError(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): Error & {
  status: number;
  response: {
    status: number;
    data: unknown;
    headers: Record<string, string>;
    config: InternalAxiosRequestConfig;
  };
} {
  const error = new Error(`Request failed with status ${status}`) as Error & {
    status: number;
    response: {
      status: number;
      data: unknown;
      headers: Record<string, string>;
      config: InternalAxiosRequestConfig;
    };
  };
  error.status = status;
  error.response = { status, data, headers: {}, config };
  return error;
}

/**
 * The decoded store-file path from a captured request whose URL targets
 * `/api/v1/store/files/<encodedPath>` (undefined for other URLs, e.g. the
 * collection endpoints).
 */
export function decodedStoreFilePath(path: string): string | undefined {
  const marker = "/api/v1/store/files/";
  const index = path.lastIndexOf(marker);
  if (index < 0 || index + marker.length >= path.length) return undefined;
  return decodeURIComponent(path.slice(index + marker.length));
}

/**
 * Parsed JSON body of a captured request — axios serializes JSON payloads
 * BEFORE the adapter runs, so `config.data` arrives as a string (objects pass
 * through as-is).
 */
export function jsonBody(request: CapturedRequest): Record<string, unknown> {
  const raw = request.body;
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/** Form-data field value of a multipart captured request (string | File | null). */
export function formFieldValue(request: CapturedRequest, field: string): string | File | null {
  if (typeof FormData !== "undefined" && request.body instanceof FormData) {
    return request.body.get(field);
  }
  return null;
}
