import type { AppConfig, BuiltInMcpServer } from "./appConfig";

/**
 * MCP servers permanently mounted by the mcp-raganything backend
 * (see mcp-raganything `main.py` mounts and README "Transport" section).
 *
 * Mount paths are fixed by the backend, so the frontend can derive the full
 * URL from the raganything base URL without a config.json redeploy. Entries
 * already declared in `builtInMcpServers` keep winning (name-based dedupe) so
 * that deploy-time configs stay the source of truth for the RAG mount.
 */
const RAGANYTHING_MCP_MOUNTS: ReadonlyArray<{
  readonly name: string;
  readonly path: string;
}> = [
  { name: "Memories", path: "/memories/mcp" },
  { name: "Web Search", path: "/web/mcp" },
];

const TRAILING_SLASH = /\/$/;

function ragAnythingBaseUrl(config: AppConfig): string {
  // The built-in MCP mounts live on the raganything brick; mcpApiBaseUrl is
  // only a legacy fallback (both point at raganything in current setups).
  return config.ragApiBaseUrl || config.mcpApiBaseUrl;
}

/**
 * Complete the config's built-in MCP server list with the canonical
 * raganything mounts (Memories, Web Search) that the deployment's
 * `builtInMcpServers` entry predates. Each built-in appears exactly once:
 * config-declared entries are never reordered, renamed or shadowed, missing
 * canonical ones are appended. An empty list stays empty — a deployment that
 * opted out of built-in display is left untouched.
 */
export function completeBuiltInMcpServers(config: AppConfig): AppConfig {
  const baseUrl = ragAnythingBaseUrl(config).replace(TRAILING_SLASH, "");
  const configured = config.builtInMcpServers;

  if (configured.length === 0 || !baseUrl) {
    return config;
  }

  const knownNames = new Set(configured.map((server) => server.name));
  const derived: BuiltInMcpServer[] = RAGANYTHING_MCP_MOUNTS.flatMap((mount) =>
    knownNames.has(mount.name)
      ? []
      : [{ name: mount.name, url: `${baseUrl}${mount.path}`, transport: "http" }],
  );

  if (derived.length === 0) {
    return config;
  }

  return { ...config, builtInMcpServers: [...configured, ...derived] };
}
