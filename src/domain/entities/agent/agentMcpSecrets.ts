import type { McpServerConfig } from "./mcpServerConfig";

/**
 * MCP secret redaction for exported agent documents (spec §5 Security,
 * REQ-LEGACY-004 / REQ-MCP-003): an exported agent YAML — top-level or
 * sub-agent inline definition — never carries credentials. Credentials are
 * stored ONLY by the MCP Registry; the export keeps the server identity and
 * its non-secret connection/behavior data so legacy documents stay readable
 * (REQ-LEGACY-001). Any future exporter (bundle export, clipboard copy,
 * support dump) must consume these pure functions rather than re-encoding
 * the rule.
 */

/**
 * Header names whose VALUES are credentials ("Bearer …", cookies, API keys).
 */
export const SECRET_HEADER_PATTERN = /^(authorization|proxy-authorization|x-api-key|cookie)$/i;

/**
 * Best-effort NAME heuristic for environment variables bearing credentials
 * (`GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, `DB_PASSWORD`, `API_KEY`, …).
 * Name-based redaction removes the whole entry — the value is never emitted,
 * so only secret-KEYED variables can ever match.
 */
export const SECRET_ENV_KEY_PATTERN =
  /(token|secret|password|passwd|api[_-]?key|credential|private[_-]?key)/i;

/** Drops credential-bearing headers; non-secret transport headers survive. */
export function redactSecretHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !SECRET_HEADER_PATTERN.test(key)),
  );
}

/** Drops credential-named environment variables; behavior variables survive. */
export function redactSecretEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !SECRET_ENV_KEY_PATTERN.test(key)),
  );
}

/**
 * Export shape of an inline MCP server definition: identity, transport,
 * arguments and non-secret connection data — secret-bearing headers redacted,
 * credential-named env entries dropped, `auth_token` deliberately NOT
 * serialized. Applied uniformly to every legacy inline definition path
 * (top-level `mcp_servers` and every sub-agent's `mcp_servers`).
 */
export function redactMcpServerForExport(server: McpServerConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: server.name,
    transport: server.transport,
    args: server.args,
    headers: redactSecretHeaders(server.headers),
    env: redactSecretEnv(server.env),
  };

  if (server.command) result.command = server.command;
  if (server.url) result.url = server.url;
  // `auth_token` is deliberately NOT serialized.

  return result;
}

/** MCP shape of an exported agent document. `mcp_refs` is `undefined` only
 *  for a hand-built legacy object that never carried the key — the serialized
 *  YAML key is omitted in that case; a backend-persisted document always
 *  echoes its (possibly empty) list (`BUG-001`). */
export interface ExportedMcpSelection {
  readonly mcp_refs: string[] | undefined;
  readonly mcp_servers: Array<Record<string, unknown>>;
}

/**
 * Discrimination between the LEGACY inline export shape and the resource-only
 * selection shape (BUG-001 / spec §4.I+§4.F).
 *
 * The discriminator is the presence of INLINE DEFINITIONS — never the
 * presence of the `mcp_refs` key: the backend contract returns `mcp_refs` as
 * a list for every agent (`AgentConfig.mcp_refs: list[str] =
 * Field(default_factory=list)`, never null), so the key does not mean
 * "resource-only". Concretely:
 *
 *  - a non-empty reference selection wins over stale inline definitions
 *    (REQ-MCP-003): the export carries the identities and an explicitly
 *    empty inline list — no inline definition, no secret;
 *  - with no registered selection, inline definitions are the agent's MCP
 *    configuration: they are exported REDACTED (legibility REQ-LEGACY-001,
 *    no secrets REQ-LEGACY-004) — dropping them would silently lose the
 *    agent's servers on re-import;
 *  - an explicitly EMPTY selection (empty refs, no inline definitions) is
 *    echoed back as-is, so a resource-only agent never "falls back" to
 *    inline and its empty selection stays explicit.
 */
export function resolveMcpExportSelection(
  mcpRefs: readonly string[] | undefined,
  inlineServers: readonly McpServerConfig[],
): ExportedMcpSelection {
  if (mcpRefs != null && mcpRefs.length > 0) {
    return { mcp_refs: [...mcpRefs], mcp_servers: [] };
  }
  return {
    mcp_refs: mcpRefs == null ? undefined : [...mcpRefs],
    mcp_servers: inlineServers.map(redactMcpServerForExport),
  };
}
