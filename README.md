# Composable UI

React frontend for interacting with the [composable-agents](https://github.com/soludev/bricks/composable-agents) API. Provides a chat interface for AI agents with real-time streaming, human-in-the-loop (HITL) tool validation, and full agent management.

## Features

- **Agent management** — Create, view, configure, and delete agents via YAML file upload
- **Unified resource-card system** — Agents, Prompts, Models, Crons, Skills, Memories, and MCP Registry share one `ResourceCard` composition: the Agent-reference surface treatment, icon block, title/badge slot, equal-height grids, separated action footer, responsive 1/2/3-column grid, and right-aligned icon-only delete with target-specific accessible names. Crons use the same resource cards (not full-width rows), and long badge content truncates safely without collapsing the title.
- **Viewport-safe dialogs** — Shared Dialog/AlertDialog primitives bound content to the available dynamic viewport, scroll internally with overscroll containment, keep a 1rem screen gutter, and expose comfortable responsive padding. Structured agent/skill/memory/MCP dialogs use fixed headers/footers with explicitly bounded, scrollable bodies; the Agent configuration view and edit modes both expose every field/action without clipping.
- **Built-in assistant first** — `composable-ai-assistant` is overlaid into every user's catalog with a `built-in` badge. Each user can personalize its editable fields with Edit and restore the platform default with Reset to Default; deletion stays unavailable and the assistant does not bypass the manual New Conversation chooser.
- **MCP thread source badge** — Thread sidebar, chat header/history, trace list, and trace detail render `CHAT`, `CRON`, or the new `MCP` source value. One-shot MCP executions produce `MCP` threads.
- **LLM onboarding surface** — A missing per-user LLM configuration is surfaced as a clear, actionable error with a direct link to `/settings`.
- **Prompts registry UI** — `/prompts` manage the local per-user prompt registry: list/create/edit metadata, view immutable numeric version history, add new content versions (`New Version` action), read any version's verbatim content, and delete an unreferenced prompt (in-use prompts surface a `409 Conflict` without losing the current view or the dialog state).
- **Models catalog UI** — `/models` manage the identity-only per-user model catalog (display name and provider model identifier). Provider, base URL, and API key are configured exclusively in LLM Settings; cards expose the model identity only, and there are no API-key or credential fields anywhere in the UI.
- **Crons UI** — `/crons` manage per-user scheduled agent invocations: create/edit with five-field cron + IANA timezone validation (UTC default), enable/disable with immediate `next_run_at` recalculation, **Run now** including disabled jobs, and a run-history dialog with trigger, terminal status, timing, safe error summary, CHAT/CRON thread-source pill, and a direct link to the run's trace.
- **Traces Explorer UI** — `/traces` (and `/traces/:threadId`) an **LLM usage dashboard** with `Dashboard` / `Runs` / `Threads` sub-tabs (Dashboard is the default): KPI cards (tokens in/out/total with a per-agent sub-line, USD cost estimate, runs completed + error count + error rate, median/p95 durations), inline-SVG breakdowns (horizontal stacked bars per agent, donut per model, UNPRICED badge for models without a price), a top-N most-expensive-runs table whose rows navigate to the read-only `/traces/:threadId` detail, and period (7 days / 30 days / custom from→to) + agent (exact-name) + model filters wired to both `GET /api/v1/traces/usage` and `GET /api/v1/traces/usage/top`. The `Threads` sub-tab preserves the existing per-thread history (source pills, cursor pagination, read-only detail) unchanged.
- **Thread source pills** — A noninteractive `ThreadSourceBadge` (read-only active-skills pill styling, `data-od-id="thread-source-badge"`, accessible label `Thread source: …`) distinguishes `CHAT`, `CRON`, and one-shot `MCP` threads in the `ThreadSidebar`, the chat header, the trace list/detail, and the cron run-history. The badge is read-only and additive; agent execution is the only place that creates `MCP`.
- **Agent create/edit selectors** — The agent form is resource-only: it uses Catalog model and Registry prompt selections (Latest by default, pinned version optional), plus MCP Registry identity selection (`mcp_refs`) for custom and built-in agents. Inline model, prompt, prompt-file and free-form MCP connection modes are no longer part of the creation/edit UX. The read-only `AgentConfigViewer` resolves `prompt_ref`/`model_ref` against the user's registries to show human-readable names, with "Loading registry…" / "Registry unavailable" states instead of raw UUIDs. Legacy inline exports remain readable but secrets are redacted.
- **Real-time chat with trace timeline** — Stream AI responses via SSE as `TraceEvent`s and render a per-turn timeline (thinking, content, tool calls, subagent panels)
- **Chat attachments** — Attach images and documents from the chat composer (📎 `chat-attach-button`). Images always allowed and sent to the LLM as vision content blocks (preview rendered inline in the composer, the pending bubble and history via the user's LangGraph store). Documents (PDF/DOCX/…) only offered when the agent exposes a `/files/mcp` MCP server (backend-authoritative policy — API clients are rejected with an explicit 422 otherwise); they render as file chips (icon, name, size, MIME) and are never displayed as raw content. Sent as base64 in the `attachments` field of the chat JSON body; never uploaded by the frontend itself.
- **PDF tool result actions** — A valid `create_pdf` tool result renders **Preview** and **Download** actions: Preview opens a dialog that fetches the PDF from the store API **only on click**, then lazily loads `react-pdf` (worker chunk-split, `.mjs` served as `application/javascript` by nginx — see `nginx.conf`) and renders paginated with prev/next navigation and `Page X / N`; Download saves an `application/pdf` blob named after the tool result. Other tool results keep the generic collapsed rendering.
- **Human-in-the-loop** — Review and approve/reject tool calls before execution
- **Thread history** -- Conversation threads grouped by agent in a sidebar
- **RAG file browser** -- Browse MinIO folders and files with breadcrumb navigation and file metadata display. Create new folders (`CreateFolderDialog` triggered by the "New folder" button in the RAG browse tab) and delete files or folders via a trash-icon row action confirmed through a `ConfirmDeleteDialog`. Folder deletion is recursive and targets the MinIO prefix; file deletion targets a single object. Both calls hit the `POST /api/v1/files/folders` and `DELETE /api/v1/files` / `DELETE /api/v1/files/folders` endpoints exposed by `mcp-raganything`. Multi-file upload with drag-and-drop and folder upload support (see [File upload](#file-upload)).
- **Tetris design system** -- Dark arcade visual language aligned with the Open Design `composable` maquette: magenta accent, Press Start 2P applied to all text (display, body, labels, buttons, nav, chat), block shadows, and `steps(2, end)` easing. Light theme toggle available from the Settings page.
- **Settings** -- A dedicated `/settings` page (5 cards: Theme, Typography, LLM Provider, API Keys, Reset) backed by a persisted Zustand store for appearance and the composable-agents backend for per-user credentials, aligned to the Open Design maquette via `data-od-id` QA attributes. A "Sign out" button in the page header clears the oauth2-proxy cookie session.
- **In-app user documentation** -- A dedicated `/documentation` area (`Documentation` item in the left menu's System group): twelve task-oriented chapters (Getting Started first), a section navigation with active-state marking and stable per-section URLs (`/documentation/:sectionSlug`, refresh/Back/Forward safe), a mobile "Sections" disclosure, and a safe not-found fallback for unknown URLs. Content is bundled with the frontend (no documentation service, not user-editable) and written as user-facing functional guidance; developer-facing docs stay in this README.

## Tech Stack

- **Runtime**: Bun
- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **Styling**: Tailwind CSS 4 + shadcn/ui + Framer Motion + lucide-react icons
- **State**: Zustand (local) + TanStack React Query (server)
- **Forms**: React Hook Form + Zod validation
- **Testing**: Vitest + Testing Library (feature QA specs run in `soludev-compose-apps/bricks/e2e`)
- **PDF preview**: react-pdf 11 (lazy-loaded `PdfCanvas` + PDF.js worker as a separate Vite asset)
- **Linting**: ESLint + Prettier

## Design System

The UI implements the **Tetris** design system derived from the [Open Design](https://opencode.ai) `composable` project maquette. Source-of-truth artifacts live under the Open Design project (`DESIGN.md`, `composable-tokens.css`, `app.html`, `styles.css`).

### Visual language

- **Theme**: Dark arcade (default) with a light alternative. Toggle from the Settings page (`/settings` > Theme card). The active toggle persists to `localStorage["composable-ui-settings"]`; the legacy `composable-ui-theme` key is still written by `useThemeStore` for anti-FOUC during boot but is no longer driven by the UI.
- **Colors**: near-black ink background (`#050816`), ink-blue surfaces (`#10162a`), one electric-magenta accent (`#ff00ff`), terminal-style semantic colors (`--success` green, `--warn` yellow, `--danger` red). Light theme uses the same token names with accessible light values.
- **Typography**: `Press Start 2P` is now applied to all text — display, body, labels, buttons, nav, and chat — bringing the UI to full parity with the Open Design maquette. Mono uppercase with `0.1em` tracking for badges/tags.
- **Shape**: sharp corners (`0px` radius) everywhere; icon buttons are now `rounded-none` (previously `rounded-full`) to match the maquette. The only round elements are the Switch toggle and the sidebar avatar (`--radius-pill`).
- **Elevation**: hard block shadows (`4px 4px 0` black for buttons, `0 18px 0` for raised panels) — never soft diffuse shadows. Primary buttons collapse their shadow on `:active` via `translate(4px, 4px)`.
- **Resource cards & dialogs**: resource cards and modal shells use the same shared primitives above; one-off layout class strings do not re-declare the design-system treatment.
- **Motion**: `steps(2, end)` easing for an arcade hard-cut feel. Durations `80ms` (fast) / `140ms` (base). All animations disabled under `prefers-reduced-motion: reduce`.
- **Icons**: [lucide-react](https://lucide.dev) throughout (tree-shakeable, consistent with shadcn/ui).

### Token layer

CSS custom properties live in `src/application/index.css` under `:root` (light) and `:root.dark` (dark, default). Tailwind v4 `@theme` maps them to utilities (`bg-bg`, `bg-surface`, `text-fg`, `border-border`, `bg-accent`, `font-display`, `shadow-raised`, `ease-standard`, `animate-*`, etc.). Custom utilities: `.block-shadow`, `.block-shadow-raised`, `.focus-ring`, `.cursor-blink`, `.scan-effect`, `.spin`, `.view-enter`.

### Layout

The app shell faithfully reproduces the maquette: a 220px left `Sidebar` (brand, nav, footer) + `MainHeader` (sticky, mobile menu button + route-derived title only — the header right side is now empty) + a scrollable `main` content area. The sidebar exposes a `System` section with `Documentation` (`data-od-id="nav-documentation"` → the in-app user guide at `/documentation`) and `Settings` (`data-od-id="nav-settings"`) nav links. On mobile (`<768px`) the sidebar becomes off-canvas with a backdrop. The chat view adds a 260px `ThreadSidebar` inside a `chat-layout` grid (hidden below `lg:1024px`).

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [composable-agents](https://github.com/soludev/bricks/composable-agents) API running on port 8010
- [mcp-raganything](https://github.com/soludev/bricks/mcp-raganything) API running on port 8020
- [oauth2-proxy](https://oauth2-proxy.github.io/) fronting the backend(s), issuing a cookie session shared across the `.soludev.tech` subdomain (see [Authentication](#authentication))

## Installation

```bash
bun install
```

## Configuration

Configuration is loaded at runtime from `public/config.json`. Copy the example file to get started:

```bash
cp public/config.example.json public/config.json
```

**`public/config.json`** - Application configuration:

| Field             | Type                | Description                                                                                                             |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apiBaseUrl`      | `string`            | composable-agents API URL (e.g., `http://localhost:8010`)                                                               |
| `ragApiBaseUrl`   | `string` (optional) | RAG API URL for MinIO file browsing (e.g., `http://localhost:8020`). Defaults to `apiBaseUrl` if not set.               |
| `wsBaseUrl`       | `string`            | WebSocket URL for streaming (e.g., `ws://localhost:8010`)                                                               |
| `mcpApiBaseUrl`   | `string` (optional) | MCP API base URL (e.g., `http://localhost:8030`). Defaults to empty string when no MCP registry is deployed.            |

The config is validated with Zod on startup. Invalid configuration will show an error toast.

**Note:** `config.json` is gitignored. Use `config.example.json` as a template.

## Authentication

Authentication is delegated to **[oauth2-proxy](https://oauth2-proxy.github.io/)** using a cookie session shared across the `.soludev.tech` subdomain. There is no client-side SDK or token in `localStorage`; the browser sends the cookie with every request and oauth2-proxy validates it server-side before forwarding to the backend.

### Cookie-based credentials (`withCredentials`)

All axios instances — `apiClient` (composable-agents), `ragApiClient` (mcp-raganything), and `mcpApiClient` (MCP registry) — are configured with `withCredentials: true`, so the oauth2-proxy session cookie travels with every cross-subdomain request. The SSE stream (`fetchEventSource` in `chatApi.ts`) opens with `credentials: "include"` for the same reason.

### 401 → sign-in redirect

Each axios instance has a response interceptor that, on a `401 Unauthorized`, calls `redirectToSignIn()` from `src/infrastructure/auth/oauth2Redirect.ts`. This navigates the browser to:

```
/oauth2/start?rd=<encodeURIComponent(currentUrl)>
```

The `rd` parameter bounces the user back to the page they were on once oauth2-proxy has re-established the session. A guard (`isOnAuthPage()`) prevents infinite redirect loops: if the current path is already `/oauth2/start` or `/oauth2/sign_out`, the redirect is a no-op. The SSE handler in `chatApi.ts` performs the same check when the event source returns a `401`.

### Sign out

The "Sign out" button in the `/settings` page header calls `redirectToSignOut()`, which navigates to `/oauth2/sign_out` and clears the cookie session. There is no client-side logout logic — the backend/oauth2-proxy owns session termination.

## Settings

The `/settings` page groups user preferences into five cards. Appearance settings (Theme, Typography, Reset) are wired to the persisted `useSettingsStore` (Zustand, `localStorage["composable-ui-settings"]`); credential cards (LLM Provider, API Keys) persist to the composable-agents backend via per-user endpoints. The page and its controls carry `data-od-id` attributes for QA parity with the Open Design `composable` maquette.

- **Theme** -- Accent color picker (hex input that live-updates the `--accent` CSS variable), surface shade select, and the dark/light mode switch (the toggle previously in the header now lives here).
- **Typography** -- Message font size (range slider, 10-18px) and message font family (`Press Start 2P` / Monospace / Mono / Georgia).
- **LLM Provider** -- Provider select (`anthropic` / `openai` / `google` / `mistral` / `local` / `ollama`), base URL, and API key. Persisted to the backend (replaces the legacy `localStorage`-only `apiKey`/`llmProvider`):
  - `GET /api/v1/settings/llm` — fetch the current user's settings; the API key is returned **masked** (e.g. `sk-***1234`), never in plaintext.
  - `PUT /api/v1/settings/llm` — upsert `{ provider, base_url, api_key }`; the plaintext key is sent once over HTTPS and the backend stores only a hash.
  - `DELETE /api/v1/settings/llm` — remove the current user's LLM settings.
  - Implemented by `LlmSettingsCard` → `useLlmSettings` hook → `settingsApi` adapter (`ISettingsPort`). The `LlmSettings` entity lives in `src/domain/entities/settings/llmSettings.ts`.
- **API Keys** -- Per-user personal access tokens (used as the secondary `X-API-Key` authentication mechanism alongside the oauth2-proxy cookie). A new "API Keys" card lists existing keys, lets you create a new one, and revoke any key:
  - `GET /api/v1/api-keys` — list the current user's keys (`id`, `name`, `key_prefix`, `created_at`, `last_used_at`, `revoked_at`).
  - `POST /api/v1/api-keys` with `{ name }` — create a key. The **plaintext is returned exactly once** in the response; `ApiKeysCard` shows it with a copy button and a "you won't see this again" warning. It is never persisted client-side.
  - `DELETE /api/v1/api-keys/{id}` — revoke a key (confirmed via an `AlertDialog`).
  - Implemented by `ApiKeysCard` → `useApiKeys` hook → `apiKeyApi` adapter (`IApiKeyPort`). The `ApiKeyView` / `CreatedApiKey` / `CreateApiKeyInput` entities live in `src/domain/entities/auth/apiKey.ts`.
- **Reset** -- "Reset to Defaults" button that restores the appearance settings (Theme + Typography) to their initial values. This does **not** touch backend-stored LLM settings or API keys.

The theme toggle is owned by `useSettingsStore`; the legacy `useThemeStore` (`composable-ui-theme` key) is still present for boot-time anti-FOUC but is no longer driven by the UI and is slated for removal in a future refactor. The legacy `apiKey`/`llmProvider` keys previously written to `localStorage` by `useSettingsStore` have been superseded by the backend-persisted LLM settings and are no longer used.

## Running

```bash
# Development (port 8030)
bun run dev

# Production build
bun run build

# Preview production build
bun run preview
```

## Testing

```bash
bun run test            # Run all tests (157 files, 1086 tests passing)
bun run test:watch      # Watch mode
bun run test:ui         # Vitest UI
bun run test:coverage   # With coverage report
```

The credential/auth flow is covered by:

- `tests/unit/infrastructure/api/axiosInstances.test.ts` — `withCredentials: true` and 401 → `redirectToSignIn` on all three axios instances.
- `tests/unit/infrastructure/api/auth/` — `apiKeyApi` adapter (list / create / revoke).
- `tests/unit/infrastructure/api/settings/` — `settingsApi` adapter (get / upsert / delete LLM settings).
- `tests/unit/application/hooks/auth/` — `useApiKeys` hook.
- `tests/unit/application/hooks/settings/` — `useLlmSettings` hook.
- `tests/unit/pages/SettingsPage.test.tsx` and `SettingsPage.apiKeys.test.tsx` — page-level coverage of the LLM Provider and API Keys cards.

### Build verification

```bash
bun run build            # Vite production build (must succeed with no type errors)
```

### QA via the Docker stack

The full stack (composable-agents + mcp-raganything + composable-ui + oauth2-proxy) can be brought up with the Docker Compose setup in `soludev-compose-apps/bricks`. The UI is served on **port 8030**.

> **oauth2-proxy e2e limitation:** In local QA without a real upstream IdP and the `.soludev.tech` cookie domain, the cookie session cannot be fully exercised. The 401 → `/oauth2/start` redirect and `/oauth2/sign_out` flow are therefore validated against a deployed environment where oauth2-proxy is reachable; locally, hitting a protected endpoint will simply bounce to `/oauth2/start` (expected). The per-user LLM settings and API keys endpoints can be exercised directly against the backend when running outside the proxy.

## Linting and Formatting

```bash
bun run lint            # Run ESLint
bun run lint:fix        # Auto-fix lint issues
bun run format          # Format with Prettier
bun run format:check    # Check formatting
```

## Docker

Multi-stage build: `bun` (install + build) then `nginx:alpine` (serve).

```bash
# Build image
docker build -t kaiohz/pickpro:composable-ui-latest .

# Run container (port 8030 -> nginx on 80)
docker run -p 8030:80 kaiohz/pickpro:composable-ui-latest
```

For the full stack, use the Docker Compose setup in `soludev-compose-apps/bricks`.

## Security Scans

```bash
make trivy-fs              # Trivy filesystem scan (CRITICAL/HIGH/MEDIUM)
make trivy-fs-critical     # Trivy filesystem scan (CRITICAL only, exit code 1)
make trivy-image           # Trivy image scan
make trivy-image-critical  # Trivy image scan (CRITICAL only, exit code 1)
```

## Project Structure

```
src/
  domain/                  # Business entities and port interfaces
    entities/
      agent/               # AgentConfig, AgentConfigMetadata, McpServerConfig
      auth/                # ApiKeyView, CreatedApiKey, CreateApiKeyInput (per-user API keys)
      chat/                # Message, Thread, ChatRequest, TraceEvent (6 types: human_message, ai_message, thinking, content, tool_call, tool_result), ThreadHistory
      config/              # AppConfig (Zod-validated)
      rag/                 # FileEntry, FolderEntry
      settings/            # LlmSettings, UpsertLlmSettingsInput (per-user LLM provider settings)
    ports/
      agent/agentPort.ts   # Agent repository interface
      auth/apiKeyPort.ts   # API key repository interface (IApiKeyPort)
      chat/chatPort.ts     # Chat repository interface
      config/configRepository.ts  # Config repository interface
      rag/ragFilePort.ts   # RAG file port interface
      settings/settingsPort.ts    # LLM settings repository interface (ISettingsPort)
  infrastructure/          # External adapters (API clients, config, auth helpers)
    api/
      agent/agentApi.ts    # Agent API adapter (axios)
      auth/apiKeyApi.ts    # API key adapter (IApiKeyPort → /api/v1/api-keys)
      chat/chatApi.ts      # Chat API adapter (axios + SSE, credentials: "include", emits TraceEvent)
      rag/ragApi.ts        # RAG API adapter (axios)
      axiosInstance.ts     # Shared axios instance (withCredentials + 401 → /oauth2/start)
      ragAxiosInstance.ts  # RAG axios client (withCredentials + 401 redirect)
      mcpAxiosInstance.ts  # MCP axios client (withCredentials + 401 redirect)
      settings/settingsApi.ts  # LLM settings adapter (ISettingsPort → /api/v1/settings/llm)
    auth/
      oauth2Redirect.ts    # redirectToSignIn / redirectToSignOut helpers (loop-guarded)
    config/
      configRepositoryInstance.ts  # Singleton config repository
      fileConfigRepository.ts       # File-based config implementation
  application/             # React UI layer
    components/
      agent/               # AgentCard, AgentGrid, CreateAgentDialog, AgentConfigViewer
      chat/                # ChatInput, ChatMessage, MessageList, HITLReviewPanel, ThinkingBlock, ToolCallBadge, ToolResultBlock, SubagentPanel, ChatAttachmentList, PdfPreviewDialog, PdfCanvas
      layout/              # AppShell, Sidebar (System section + Settings nav), MainHeader (mobile menu + title only), ThreadSidebar
      rag/                 # BreadcrumbBar, FileList, FileRow, FolderRow, CreateFolderDialog, ConfirmDeleteDialog, FileContentPanel, IndexActionMenu, QueryPanel, QueryResults, QueryOptions, RagTabBar, UploadButton, WorkspaceSelector
      settings/            # LlmSettingsCard, ApiKeysCard (backend-persisted credential cards)
      shared/              # SegmentedToggle, StatusBadge, ToolTag
      ui/                  # shadcn/ui primitives (Tetris-themed) incl. alert-dialog for revoke confirm
    hooks/
      agent/               # useAgents, useCreateAgent, useDeleteAgent, useUpdateAgent, useAgentConfig
      auth/                # useApiKeys (list / create / revoke)
      chat/                # useThreads, useCreateThread, useDeleteThread, useThreadHistory, useSendMessage, useStreamChat, useStoredAttachmentImages
      config/              # useConfig
      rag/                 # useFolders, useFiles, useReadFile, useUploadFile, useCreateFolder, useDeleteFile, useDeleteFolder, useClassicalIndexFile, useClassicalIndexFolder, useClassicalQuery
      settings/            # useLlmSettings (get / upsert / delete)
    pages/
      AgentsPage.tsx       # /agents route
      ChatPage.tsx         # /chat/:threadId? route
      RagPage.tsx          # /rag route
      SettingsPage.tsx     # /settings route (Theme, Typography, LLM Provider, API Keys, Reset cards + Sign out button)
    stores/
      useChatStore.ts      # Zustand store for chat state
      useSettingsStore.ts  # Zustand store for Settings page (theme, accent, typography — appearance only; credentials now backend-persisted)
      useThemeStore.ts     # Legacy Zustand store for theme (dark/light) + persistence (still used for boot-time anti-FOUC)
      useSidebarStore.ts   # Zustand store for mobile sidebar open/close
public/
  config.example.json      # Example config (committed)
  config.json              # Runtime config (gitignored)
tests/
  unit/                    # Mirrors src/ structure
  fixtures/                # Test data
  utils/                   # Test helpers (custom render)
```

## Routes

| Path               | Page         | Description                                                                    |
| ------------------ | ------------ | ------------------------------------------------------------------------------ |
| `/`                | --           | Redirects to `/chat`                                                           |
| `/agents`          | AgentsPage   | List, create, view, and delete agents                                          |
| `/chat/:threadId?` | ChatPage     | Chat with agents, streaming responses, HITL validation                         |
| `/rag`             | RagPage      | Browse MinIO folders and files with breadcrumb navigation                      |
| `/skills`          | SkillsPage   | Browse/edit skill files served from the LangGraph store                        |
| `/memories`        | MemoriesPage | Browse/edit memory files served from the LangGraph store                       |
| `/mcp-registry`    | McpRegistryPage | Browse/validate MCP servers exposed by the mcp-raganything registry      |
| `/prompts`         | PromptsPage  | List, create, edit metadata, inspect immutable versions, and delete prompts    |
| `/models`          | ModelsPage   | List, create, edit metadata-only model definitions (no credential UI)          |
| `/crons`           | CronsPage    | List, create, validate, enable/disable, Run now, and inspect run history       |
| `/traces/:threadId?` | TracesPage | LLM usage dashboard (Dashboard / Runs / Threads sub-tabs) + read-only thread detail |
| `/settings`        | SettingsPage | Theme, typography, LLM provider (backend-persisted), API keys (backend-persisted), reset, and Sign out |
| `/documentation`   | DocumentationPage | In-app user guide — landing section (Getting Started) |
| `/documentation/:sectionSlug` | DocumentationPage | Stable per-section URLs for the twelve guide chapters; unknown slugs render a not-found fallback |
| `/documentation/*` | DocumentationPage | Catch-all for nested/unmatched documentation paths — same safe not-found fallback, never a blank page |

## LLM Usage Dashboard

The `/traces` page is now a real LLM usage dashboard (backend-backed by `GET /api/v1/traces/usage` and `GET /api/v1/traces/usage/top`, both RLS-scoped per user):

- **Sub-tabs** — `Dashboard` (default), `Runs` (the top-N table), and `Threads` (the read-only per-thread history exactly as it existed before: CHAT/CRON source pills, cursor pagination, detail navigation).
- **KPI cards** (`UsageKpiCards`) — tokens in/out/total with the top-3 agents sub-line; USD cost estimate; runs completed + errors + error rate (error rate uses the disjoint `run_count` + `error_count` denominator — completed and error runs are separate sets); median and p95 durations formatted (`350 ms`, `1.2 s`). An error-only window still renders its KPIs.
- **Breakdown charts** — `AgentUsageBarChart` (horizontal bars, stacked input/output, scaled to the largest agent) and `ModelUsageDonut` (inline-SVG donut, dasharray share per model, UNPRICED legend badge when a model has no price row). Both are inline SVG on existing Tetris primitives — no chart library.
- **Top runs** (`TopRunsTable`) — most expensive runs ranked by cost (native anchors navigate to the read-only `/traces/:threadId` detail). Sub-cent costs render with adaptive precision (`$0.00001`, never a misleading `$0.0000`); a narrowed (model-filtered) empty pool gets an honest explanation instead of a bare "no runs".
- **Filters** (`TracesFilters`) — period (7 days / 30 days / custom from→to: a custom range applies only once **both** dates are picked, otherwise the 7-day window stays active and the filter bar says so), exact agent-name (+ All), optional model filter (labeled "Model (runs list)": it narrows the fetched top runs client-side — the pool widens to the endpoint cap of 100 while a model is selected — and never re-computes the backend KPIs). Every filter change re-queries both endpoints.
- **Resilience** — contract drift is a retryable query error with a short actionable message (raw validation payloads never render); loading / error + retry / empty / no-results states are distinct; KPI cards, charts and tables carry stable `data-od-id` attributes for QA.

## Agent Configuration

The agent creation/edit form (in `CreateAgentDialog`) reflects the current backend schema. The following UI changes have been made:

- **General section** — A new **Description** text input is available alongside the agent name. Tools are no longer managed here; they are configured exclusively via MCP servers (see the MCP servers section of the form).
- **Debug toggle removed** — The Debug toggle has been removed from the form.
- **Tools section removed** — Tools are managed via MCP servers only. The dedicated "Tools" section no longer appears in the form.
- **Subagents section** — A new **"Add from existing agents"** dropdown lets you select an existing agent as a subagent reference (populating `agent_ref`). When a subagent references an existing agent, a **`ref:`** badge is displayed next to its name and the name field becomes read-only (the name is derived from the referenced agent).
- **Prompt source (UPDATED)** — Only the **Prompt Registry** is accepted in the manual path. Latest applies by default; a pinned immutable version can be selected when needed. Inline and file prompt modes are no longer presented for creation/editing, and the saved document keeps `prompt_ref`.
- **Model source (UPDATED)** — Only the **Model Catalog** is accepted in the manual path. Custom model-string mode is removed for creation/editing, and the saved document keeps `model_ref`. Built-in agents without a stored customization continue to use platform defaults.
- **MCP selection (UPDATED)** — Both custom and built-in agents select servers by identity from the MCP Registry. The form serializes `mcp_refs`; URLs, commands, headers, environment entries and tokens are not entered in the agent form. Legacy inline documents stay parseable/readable, while exports redact secret headers, credential-named environment values and tokens.
- **Registry loading / error states** — Agent viewer resolves `prompt_ref`/`model_ref` against the user's registries and surfaces `Loading registry…` / `Registry unavailable — reference could not be verified` (per-registry Retry) rather than a misleading "not in registry" for a resolvable reference.

## RAG File Browser

The `/rag` page provides a MinIO-backed file browser with two tabs: **Browse** and **Query** (`RagTabBar`). The browse tab uses breadcrumb navigation driven by `useFolders` and `useFiles`, and supports the following file/folder management actions alongside read, upload and indexing:

- **Create folder** -- The "New folder" button opens a `CreateFolderDialog` that collects a folder name, then calls `useCreateFolder` which posts `POST /api/v1/files/folders` to `mcp-raganything`. The folder is created as a 0-byte trailing-slash object.
- **Delete file** -- Each `FileRow` exposes a trash-icon action that opens a `ConfirmDeleteDialog`. On confirm, `useDeleteFile` calls `DELETE /api/v1/files?object_name=...&working_dir=...` with the currently selected `working_dir` from the `WorkspaceSelector`, and invalidates the file list query. Both MinIO object and pgvector vectors are deleted (MinIO first, then pgvector).
- **Delete folder** -- Each `FolderRow` exposes a trash-icon action that opens a `ConfirmDeleteDialog` warning that the deletion is recursive. On confirm, `useDeleteFolder` calls `DELETE /api/v1/files/folders?prefix=...` and invalidates both the folder and file queries. The `prefix` is used as the `working_dir` for pgvector cleanup — no separate `working_dir` parameter is sent. Both MinIO objects and pgvector vectors are deleted (MinIO first, then pgvector).

The selected file's content is rendered by `FileContentPanel` via `useReadFile` (`POST /api/v1/files/read`).

### File upload

The `UploadButton` and surrounding browse section now support multi-file upload with drag-and-drop:

- **Multi-file selection** -- The `UploadButton` input has `multiple` enabled, so the native file picker lets users select several files at once. All selected files are queued for upload to the current `working_dir`.
- **Drag-and-drop** -- The entire browse section (file list area) is a drop zone. Users can drag files from their file explorer directly onto the list area instead of using the Upload button.
- **Folder upload via drag-and-drop** -- Users can drag a whole folder from their file explorer onto the browse section. The folder structure is preserved in MinIO via `webkitRelativePath` (each file's relative path within the dropped folder is used as its object key), so nested sub-foldolders are recreated under the current `working_dir`.
- **Concurrency** -- Uploads are limited to **3 simultaneous requests** to avoid overloading the backend. Files are dequeued from the pending queue as slots free up.
- **Partial failure handling** -- If some files upload successfully and others fail, a toast reports the split: "X uploaded, Y failed". Individual per-file errors are logged to the console.
- **Accepted extensions** -- The accepted file extensions list is aligned with the backend allow-list: `.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.csv`, `.xlsx`, `.xls`, `.ppt`, `.pptx`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.bmp`, `.rtf`, `.odt`, `.ods`.

### Indexing working directory resolution

Indexing a file or folder resolves the target working directory through `resolveWorkingDir(currentPrefix, workingDir)` (`src/application/lib/workingDir.ts`): the `WorkspaceSelector` value wins, then the folder currently being browsed, then the `default-composable` workspace. The index request therefore always fires — there is no blocking guard anymore (an earlier iteration surfaced a `Set a working_dir in the workspace selector first` toast; that guard and its string were removed). Querying behaves differently: `QueryPanel` short-circuits silently until both a `working_dir` and a non-empty query are set, so `Search` simply stays inactive with no message. The in-app user guide (`DOC-10`) documents this split accurately.

### FileContentPanel null-safety (Bug 2)

`FileContentPanel` previously crashed when the `POST /files/read` response returned `metadata: null` or `tables: null`, or when the `content` field was returned as an array of page strings (Kreuzberg multi-page output). The component now:

- Treats `metadata` and `tables` as optional, rendering an empty state instead of throwing.
- Renders `content` as a pages array when the API returns `string[]` (concatenated with a blank line), and as a plain string otherwise.
- Renders each entry in `tables` as a markdown string when it is a `string`, or via the existing `{ markdown }` shape when it is an object.

## Trace Event Model

The chat now consumes `TraceEvent`s from the backend (replacing the old `StreamEvent`). Each event has one of 6 types: `human_message`, `ai_message`, `thinking`, `content`, `tool_call`, `tool_result`. The `source` field distinguishes the parent agent (`null`) from a named sub-agent.

### Streaming components

- **`MessageList`** — uses `useThreadHistory` to fetch `GET /threads/{id}/history` and renders a timeline per turn. During streaming, the in-progress turn is rendered as a `StreamingTurn` block with sub-agent events grouped by `source`.
- **`ChatMessage`** — accepts an `events` prop to render the intermediate timeline (thinking, tool calls, tool results) beneath the AI message.
- **`ThinkingBlock`** — accepts a `source` prop and displays "Thinking — {source}" when the event comes from a sub-agent.
- **`ToolCallBadge`** — collapsable badge for a `tool_call` event, color-coded by `source`.
- **`ToolResultBlock`** — collapsable terminal-style block for a `tool_result` event.
- **`SubagentPanel`** — dedicated panel for a sub-agent (header, thinking, tool calls, content), grouped by `source`.

### Store

`useChatStore` now manages a `StreamingTurn` object instead of two simple strings:

- `events` — accumulated `TraceEvent`s for the current turn.
- `parentContent` / `parentThinking` — aggregated text for the parent agent.
- `subagents` — map of sub-agent name -> `{ content, thinking, toolCalls, toolResults }`.

### Structured response during streaming

When an agent is configured with a `response_format`, the backend attaches the structured payload to the `AI_MESSAGE` event's `content` (as a JSON-serialized `Message`), not to `metadata`. The frontend extracts it via the `getStructuredResponseFromAIEvent(ev)` helper in `traceEvent.ts`, which returns a `StructuredResponseResult` discriminated union:

| Variant     | Condition                                                | Rendered as                                                          |
| ----------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `valid`     | `AI_MESSAGE.content` parses and contains a structured response | `<StructuredResponseCard>` (JSON display)                      |
| `malformed` | `AI_MESSAGE.content` is not valid JSON                   | Inline error block: "Malformed JSON: \<error\>"                     |
| `missing`   | No structured response in the parsed `Message`          | "No structured response" placeholder — **only** if the agent has a `response_format` configured (via the `agentHasResponseFormat` prop on `StructuredResponseLive`); otherwise nothing is rendered |

The `StructuredResponseLive` component consumes this result and renders the appropriate case during streaming. The `agentHasResponseFormat` boolean is passed in from the agent configuration so the `missing` placeholder is suppressed for agents that never declare a `response_format`.

## Breaking Changes

- **`StreamEvent` removed** — replaced by `TraceEvent` (6 types). SSE parsing in `chatApi.ts` updated accordingly.
- **`useMessages` hook removed** — replaced by `useThreadHistory` (fetches `GET /threads/{id}/history`).
- **`useChatStore` refactored** — now exposes a `StreamingTurn` instead of separate `content` / `thinking` strings.

## CI/CD

- **CI** (on PR): Build + tests + Trivy FS scan + SonarQube analysis
- **CD** (on merge to main): Docker build + push to DockerHub (`kaiohz/pickpro:composable-ui-*`) + Flux image update

## License

Private -- internal use only.
