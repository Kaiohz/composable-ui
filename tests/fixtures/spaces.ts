import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import { createAgentConfigMetadata } from "./external";
import { route, type NetworkRoute } from "../utils/network";

/**
 * Fixtures for the "Scope RAG & Memories per User × Agent" feature
 * (spec scope-rag-memories-user-agent.md).
 *
 * Shapes follow the REAL backend contracts (mcp-raganything + composable-agents):
 * - `GET /api/v1/spaces` → `rag_spaces` records (REQ-010) served by
 *   MCP-RAGANYTHING — the "rag" axios client (`space_routes.py`).
 * - `GET /api/v1/agents` → the platform agent catalog (`AgentConfigMetadata`,
 *   composable-agents, "api" client) — source of the builtin-first ordering
 *   (REQ-021/REQ-026).
 * - `GET /api/v1/users/me` → public profile with the authenticated `user_id`
 *   (snake_case — the composable-agents `UserProfile` model has no camelCase
 *   aliasing).
 * - File listings: mcp-raganything composes the scope SERVER-SIDE — the client
 *   sends RELATIVE prefixes plus the `X-Composable-Agent` header (REQ-001/
 *   REQ-003); list responses return FULL object keys for files and
 *   SCOPE-RELATIVE prefixes for folders. `RAG_SCOPE_CONTENT` is keyed by
 *   agent slug then RELATIVE prefix.
 * - Memories: `/memories/{agent_slug}/{name}.md` vs flat `/memories/{name}.md`
 *   (REQ-012/REQ-022 — the namespace IS the client path on the store API).
 */

export const USER_ID = "user-123";

/** `rag_spaces` record as returned by `GET /api/v1/spaces` (REQ-010 columns). */
export interface SpaceRecord {
  readonly agent_slug: string;
  readonly working_dirs: string[];
  readonly created_at: string;
  readonly last_used_at: string | null;
}

export function createSpaceRecord(overrides: Partial<SpaceRecord> = {}): SpaceRecord {
  return {
    agent_slug: "agent-x",
    working_dirs: [],
    created_at: "2026-11-01T08:00:00Z",
    last_used_at: null,
    ...overrides,
  };
}

/**
 * `GET /api/v1/spaces` response — deliberately NOT sorted, and WITHOUT a
 * `personal` record (REQ-019: the built-in assistant uses the personal scope
 * without provisioning, so the space list may not contain personal at all).
 * `composable-ai-assistant` is the builtin platform agent, `agent-zeta` a
 * custom platform agent, `opencode` a lazily-created external coding-agent
 * scope.
 */
export const SCRAMBLED_SPACES: readonly SpaceRecord[] = [
  createSpaceRecord({ agent_slug: "agent-zeta" }),
  createSpaceRecord({ agent_slug: "composable-ai-assistant" }),
  createSpaceRecord({ agent_slug: "opencode" }),
];

/**
 * Edge variant: the backend MAY include an explicit `personal` record (a
 * `POST /api/v1/spaces {"agent_slug": "personal"}` passes the charset
 * validator) — the selector must FILTER it out (the personal namespace is a
 * system-internal fallback) while every other space survives (user × agent
 * directive).
 */
export const SPACES_WITH_PERSONAL: readonly SpaceRecord[] = [
  createSpaceRecord({ agent_slug: "opencode" }),
  createSpaceRecord({ agent_slug: "personal" }),
];

/** Platform agent catalog (`GET /api/v1/agents`) backing the builtin-first ordering. */
export const AGENTS_CATALOG: readonly AgentConfigMetadata[] = [
  createAgentConfigMetadata({ name: "composable-ai-assistant", is_builtin: true }),
  createAgentConfigMetadata({ name: "agent-zeta", is_builtin: false }),
];

/**
 * The scoped option list contract: platform agents (builtin first) then
 * external space records — Personal is NOT an option anymore.
 */
export const EXPECTED_SPACE_LABELS: readonly string[] = [
  "composable-ai-assistant",
  "agent-zeta",
  "opencode",
];

export interface RagFile {
  readonly object_name: string;
  readonly size: number;
  readonly last_modified: string | null;
}

export interface RagContent {
  readonly folders: readonly string[];
  readonly files: readonly RagFile[];
}

/**
 * MinIO listings served per CALLER SCOPE (REQ-005): files carry FULL bucket
 * keys while folders are SCOPE-RELATIVE (backend `relativize_folders`), so
 * the file browser shows the content of the SELECTED space only. Keyed by
 * agent slug (the `X-Composable-Agent` header value) then RELATIVE prefix —
 * the relative prefix `""` is the scope root of the selected space.
 *
 * `composable-ai-assistant` is the builtin-FIRST catalog agent — the page
 * default (the personal namespace is not a selectable surface anymore), so
 * its content is what the pages show before any user selection.
 */
export const RAG_SCOPE_CONTENT: Record<string, Record<string, RagContent>> = {
  "composable-ai-assistant": {
    "": {
      folders: [],
      files: [
        {
          object_name: `${USER_ID}/composable-ai-assistant/assistant-readme.md`,
          size: 96,
          last_modified: "2026-11-01T08:00:00Z",
        },
      ],
    },
  },
  "agent-zeta": {
    "": {
      folders: ["zeta-docs/"],
      files: [
        {
          object_name: `${USER_ID}/agent-zeta/zeta-readme.md`,
          size: 240,
          last_modified: "2026-11-02T08:00:00Z",
        },
      ],
    },
    "zeta-docs/": {
      folders: [],
      files: [
        {
          object_name: `${USER_ID}/agent-zeta/zeta-docs/zeta-doc.md`,
          size: 42,
          last_modified: "2026-11-03T08:00:00Z",
        },
      ],
    },
  },
};

export interface MemoryPreview {
  readonly path: string;
  readonly preview: string;
}

export interface MemoriesContent {
  readonly files: readonly string[];
  readonly previews: readonly MemoryPreview[];
}

/** Store listings by prefix: agent-scoped namespaces (the flat personal
 * namespace is kept as an edge fixture — the store's startswith filter leaks
 * nested rows into the flat listing, REQ-012). */
export const MEMORIES_BY_PREFIX: Record<string, MemoriesContent> = {
  // The composable-agents store listing is a plain startswith filter, so the
  // FLAT namespace returns the nested agent rows too — exactly what
  // mcp_memory_tools forbids surfacing ("one scope never merges into another",
  // REQ-012); the fixture keeps them (including a SAME-BASENAME collision:
  // /memories/zeta-notes.md vs /memories/agent-zeta/zeta-notes.md).
  "/memories/": {
    files: [
      "/memories/user-prefs.md",
      "/memories/zeta-notes.md",
      "/memories/agent-zeta/zeta-notes.md",
    ],
    previews: [
      { path: "/memories/user-prefs.md", preview: "Personal memory preview" },
      { path: "/memories/zeta-notes.md", preview: "Personal zeta-notes" },
      { path: "/memories/agent-zeta/zeta-notes.md", preview: "Agent memory preview" },
    ],
  },
  // The builtin-FIRST catalog agent — the page default (Personal is not a
  // selectable surface anymore).
  "/memories/composable-ai-assistant/": {
    files: [
      "/memories/composable-ai-assistant/assistant-prefs.md",
      "/memories/composable-ai-assistant/assistant-log.md",
    ],
    previews: [
      { path: "/memories/composable-ai-assistant/assistant-prefs.md", preview: "Assistant prefs preview" },
      { path: "/memories/composable-ai-assistant/assistant-log.md", preview: "Assistant log preview" },
    ],
  },
  "/memories/agent-zeta/": {
    // The same startswith leak exists INSIDE an agent scope: a nested
    // `/memories/agent-zeta/archive/…` row also comes back — the grid must
    // keep only direct children (isDirectMemoryChild, REQ-012).
    files: ["/memories/agent-zeta/zeta-notes.md", "/memories/agent-zeta/archive/old-note.md"],
    previews: [
      { path: "/memories/agent-zeta/zeta-notes.md", preview: "Agent memory preview" },
      { path: "/memories/agent-zeta/archive/old-note.md", preview: "Nested archive note" },
    ],
  },
};

/** Full memory file bodies used by the Viewer (GET single store file). */
export const MEMORY_FILES: Record<string, string> = {
  "/memories/composable-ai-assistant/assistant-prefs.md": "# Assistant prefs",
  "/memories/composable-ai-assistant/assistant-log.md": "# Assistant log",
  "/memories/agent-zeta/zeta-notes.md": "# Zeta notes",
};

/** Spaces (mcp-raganything "rag" client) + agents catalog + current-user routes. */
export function spacesRoutes(spaces: readonly SpaceRecord[] = SCRAMBLED_SPACES): NetworkRoute[] {
  return [
    route("rag", "GET", /\/api\/v1\/spaces$/, () => ({ status: 200, data: [...spaces] })),
    route("api", "GET", /\/api\/v1\/agents$/, () => ({ status: 200, data: [...AGENTS_CATALOG] })),
    route("api", "GET", /\/api\/v1\/users\/me$/, () => ({
      status: 200,
      data: { user_id: USER_ID, email: "yohan@example.com", name: "Yohan" },
    })),
  ];
}

/**
 * Files/classical routes of the mcp-raganything backend under the REAL scope
 * contract: the caller sends RELATIVE prefixes plus the `X-Composable-Agent`
 * header (REQ-001/REQ-003/REQ-006), and listings mirror the backend shapes
 * (full file keys, scope-relative folder prefixes).
 */
export function ragRoutes(
  content: Record<string, Record<string, RagContent>> = RAG_SCOPE_CONTENT,
): NetworkRoute[] {
  const resolve = (ctx: {
    headers: Record<string, string>;
    query: Record<string, string>;
  }): RagContent => {
    const tree = content[ctx.headers["x-composable-agent"] ?? ""] ?? {};
    const relativePrefix = ctx.query.prefix ?? "";
    return tree[relativePrefix] ?? { files: [], folders: [] };
  };
  return [
    route("rag", "GET", /\/api\/v1\/files\/folders$/, (ctx) => ({
      status: 200,
      data: [...resolve(ctx).folders],
    })),
    route("rag", "GET", /\/api\/v1\/files\/list$/, (ctx) => ({
      status: 200,
      data: [...resolve(ctx).files],
    })),
    route("rag", "POST", /\/api\/v1\/classical\/query$/, () => ({
      status: 200,
      data: { status: "ok", message: "", queries: [], chunks: [], mode: "vector" },
    })),
    route("rag", "POST", /\/api\/v1\/classical\/file\/index$/, () => ({
      status: 200,
      data: { status: "ok", message: "indexed" },
    })),
    route("rag", "POST", /\/api\/v1\/classical\/folder\/index$/, () => ({
      status: 200,
      data: { status: "ok", message: "indexed" },
    })),
    route("rag", "POST", /\/api\/v1\/files\/folders$/, () => ({
      status: 200,
      data: { message: "created" },
    })),
    route("rag", "POST", /\/api\/v1\/files\/upload$/, () => ({
      status: 200,
      data: { message: "uploaded" },
    })),
    route("rag", "DELETE", /\/api\/v1\/files$/, () => ({
      status: 200,
      data: { message: "deleted" },
    })),
    route("rag", "DELETE", /\/api\/v1\/files\/folders$/, () => ({
      status: 200,
      data: { message: "deleted" },
    })),
  ];
}

/** Store-file routes (memories listing, previews, single-file read/put/delete). */
export function storeRoutes(
  listings: Record<string, MemoriesContent> = MEMORIES_BY_PREFIX,
): NetworkRoute[] {
  return [
    route("api", "GET", /\/api\/v1\/store\/files$/, (ctx) => ({
      status: 200,
      data: [...(listings[ctx.query.prefix ?? ""]?.files ?? [])],
    })),
    route("api", "GET", /\/api\/v1\/store\/files\/previews$/, (ctx) => ({
      status: 200,
      data: [...(listings[ctx.query.prefix ?? ""]?.previews ?? [])],
    })),
    route("api", "GET", /\/api\/v1\/store\/files\/./, (ctx) => {
      const path = decodeURIComponent(ctx.path.replace(/^.*\/api\/v1\/store\/files\//, ""));
      const content = MEMORY_FILES[path];
      return content !== undefined
        ? { status: 200, data: { path, content } }
        : { status: 404, data: { detail: "File not found" } };
    }),
    route("api", "PUT", /\/api\/v1\/store\/files\/./, () => ({
      status: 200,
      data: { path: "ok" },
    })),
    route("api", "DELETE", /\/api\/v1\/store\/files\/./, () => ({
      status: 200,
      data: {},
    })),
  ];
}
