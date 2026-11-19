/**
 * Thread origin — immutable `chat` | `cron` | `mcp` discriminator
 * (spec feat-composable-mcp.md §SRC-001 / §REQ-049). Existing rows are
 * backfilled to `chat`; cron threads are always `cron`; `mcp` marks one-shot
 * executions created by the MCP control plane (`composable_agents_run`).
 */
export type ThreadSource = "chat" | "cron" | "mcp";
