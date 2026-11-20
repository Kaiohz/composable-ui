import type { AppConfig, BuiltInMcpServer } from "./appConfig";

/**
 * MCP servers permanently mounted by the `composable-agents` FastAPI backend
 * and the `mcp-raganything` backend.  Composable Agents exposes the platform
 * control plane at `/mcp`; raganything hosts the per-user RAG/Web/Memories
 * mounts.  All of these are listed as read-only built-ins on the MCP Registry
 * page and can be registered with one click.
 */
const COMPOSABLE_AGENTS_MCP: Readonly<{
  readonly name: string;
  readonly path: string;
}> = {
  name: "Composable Agents",
  path: "/mcp",
};

const RAGANYTHING_MCP_MOUNTS: ReadonlyArray<{
  readonly name: string;
  readonly path: string;
}> = [
  { name: "Memories", path: "/memories/mcp" },
  { name: "Web Search", path: "/web/mcp" },
];

const TRAILING_SLASH = /\/$/;

function composableAgentsBaseUrl(config: AppConfig): string {
  return config.apiBaseUrl;
}

function ragAnythingBaseUrl(config: AppConfig): string {
  // The built-in MCP mounts live on the raganything brick; mcpApiBaseUrl is
  // only a legacy fallback (both point at raganything in current setups).
  return config.ragApiBaseUrl || config.mcpApiBaseUrl;
}

/**
 * Complete the config's built-in MCP server list with the canonical
 * built-ins (Composable Agents platform endpoint plus raganything RAG/Web
 * mounts) that the deployment's `builtInMcpServers` entry predates. Each
 * built-in appears exactly once: config-declared entries are never reordered,
 * renamed or shadowed, missing canonical ones are appended. A deployment that
 * opted out by omitting its built-in base URLs still gets the Composable
 * Agents endpoint when the API base URL is available.
 */
export function completeBuiltInMcpServers(config: AppConfig): AppConfig {
  const configured = config.builtInMcpServers;
  const composableAgentsUrl = composableAgentsBaseUrl(config)?.replace(TRAILING_SLASH, "");
  const ragAnythingUrl = ragAnythingBaseUrl(config)?.replace(TRAILING_SLASH, "");

  if (!composableAgentsUrl && !ragAnythingUrl) {
    return config;
  }

  const knownNames = new Set(configured.map((server) => server.name));
  const derived: BuiltInMcpServer[] = [];
  if (composableAgentsUrl && !knownNames.has(COMPOSABLE_AGENTS_MCP.name)) {
    derived.push({
      name: COMPOSABLE_AGENTS_MCP.name,
      url: `${composableAgentsUrl}${COMPOSABLE_AGENTS_MCP.path}`,
      transport: "http",
    });
  }
  const ragAnythingMounts = ragAnythingUrl
    ? RAGANYTHING_MCP_MOUNTS.filter((mount) => !knownNames.has(mount.name)).map((mount) => ({
        name: mount.name,
        url: `${ragAnythingUrl}${mount.path}`,
        transport: "http",
      }))
    : [];
  derived.push(...ragAnythingMounts);

  if (derived.length === 0) {
    return config;
  }

  return { ...config, builtInMcpServers: [...configured, ...derived] };
}
