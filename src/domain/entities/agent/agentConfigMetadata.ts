/**
 * Reserved name of the centrally managed built-in Composable AI Assistant
 * (spec feat-composable-mcp.md §REQ-031/§REQ-034). The backend overlays this
 * virtual agent into every authenticated user's catalog; it is never seeded
 * per user, cannot be created or deleted, and is listed first. Each user can
 * store a personal customization, but the name and dynamic toolset stay
 * platform-managed.
 */
export const BUILTIN_AGENT_NAME = "composable-ai-assistant";

/**
 * Destructive-delete tools whose HITL interrupt is always enforced by the
 * backend. The UI renders them as locked rules; the server re-applies the
 * floor on every read even if a stored payload drifts.
 */
export const BUILTIN_FORCED_HITL_TOOLS: readonly string[] = [
  "composable_agents_delete",
  "composable_mcp_servers_delete",
  "composable_skills_delete",
  "composable_memories_delete",
  "composable_prompts_delete",
  "composable_models_delete",
  "composable_crons_delete",
  "composable_threads_delete",
];

export interface AgentConfigMetadata {
  name: string;
  model: string;
  description?: string | null;
  minio_path: string;
  created_at: string;
  updated_at: string;
  /**
   * Additive built-in marker (§REQ-033), computed by the backend overlay:
   * `true` only for the virtual built-in assistant, `false` for custom
   * agents. Never persisted in agent YAML and never user-editable.
   */
  is_builtin: boolean;
  /** `true` when this user stored a personal built-in customization. */
  is_customized?: boolean;
}

/**
 * Whether an agent is the built-in assistant. Prefers the additive
 * `is_builtin` marker and defensively falls back to the reserved name so a
 * payload missing the marker still resolves correctly.
 */
export function isBuiltinAgent(name: string, isBuiltin?: boolean): boolean {
  return isBuiltin === true || name === BUILTIN_AGENT_NAME;
}

/**
 * Built-in-first display ordering (§REQ-045): the assistant is placed before
 * custom agents without mutating the input. The comparison is stable, so the
 * backend's relative order is preserved within each group.
 */
export function sortAgentsBuiltinFirst<T extends AgentConfigMetadata>(agents: readonly T[]): T[] {
  return agents
    .slice()
    .sort(
      (a, b) =>
        Number(isBuiltinAgent(b.name, b.is_builtin)) - Number(isBuiltinAgent(a.name, a.is_builtin)),
    );
}
