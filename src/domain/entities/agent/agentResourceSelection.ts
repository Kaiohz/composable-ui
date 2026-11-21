import type { AgentConfig } from "./agentConfig";
import type { AgentConfigFormInput } from "./agentConfigSchema";

/**
 * Resource-only selection rules (spec agent-resource-import). Pure domain
 * functions — no React, no form library: the agent form only wires state to
 * the DOM. The contract they encode:
 *
 *  - REQ-FORM-001/002 — the Model Catalog and the Prompt Registry are the
 *    ONLY sources; the legacy inline prompt/model fields are always cleared
 *    from the submitted payload. An old inline value is NOT presented as a
 *    registered resource (REQ-LEGACY-002): the selectors start empty and the
 *    save is refused until a registered selection exists.
 *  - REQ-FORM-003 / REQ-MCP-003 — the persisted MCP selection carries the
 *    identities of REGISTERED servers only, never embedded configs or
 *    secrets.
 */

export type PromptVersionMode = "latest" | "pinned";

/** Registry-source selections kept outside the YAML payload. */
export interface SourceState {
  promptId: string;
  versionMode: PromptVersionMode;
  promptVersion: number | undefined;
  modelRefId: string;
}

/**
 * Seed the selectors from a saved configuration. A stored `prompt_ref`
 * selects its prompt with its version semantics; a legacy inline value never
 * pre-selects a registry entry (REQ-LEGACY-002).
 */
export function deriveSourceState(initialData?: AgentConfig): SourceState {
  const modelRefId = initialData?.model_ref ?? "";
  const promptRef = initialData?.prompt_ref;
  if (promptRef) {
    return {
      promptId: promptRef.id,
      modelRefId,
      versionMode: promptRef.version != null ? "pinned" : "latest",
      promptVersion: promptRef.version,
    };
  }
  return { promptId: "", modelRefId, versionMode: "latest", promptVersion: undefined };
}

/** Registry-prompt payload for the selected version mode. */
export function promptRefFrom(state: SourceState): { id: string; version?: number } | undefined {
  if (!state.promptId) return undefined;
  const pinned =
    state.versionMode === "pinned" && state.promptVersion != null ? state.promptVersion : undefined;
  return { id: state.promptId, version: pinned };
}

/**
 * Merge raw form values with the registry selections before validation.
 * The legacy inline prompt/model fields are ALWAYS cleared from the
 * submitted payload, and the MCP selection is serialized as registered-server
 * identities — never as embedded configs or secrets.
 */
export function buildResourceOnlyValues(
  values: AgentConfigFormInput,
  state: SourceState,
  mcpRefs: string[],
): AgentConfigFormInput {
  return {
    ...values,
    system_prompt: undefined,
    system_prompt_file: undefined,
    model: undefined,
    prompt_ref: promptRefFrom(state),
    model_ref: state.modelRefId || undefined,
    mcp_refs: mcpRefs,
    mcp_servers: [],
    response_format: values.response_format ?? undefined,
  };
}

/**
 * Persisted MCP selection (REQ-FORM-003): when the registry list is loaded,
 * only currently registered names are serialized — names that vanished from
 * the registry are dropped rather than emitted as stale references, and the
 * caller surfaces that drop to the user. While the registry list is
 * unavailable `registryLoaded` is false and the current selection is kept
 * verbatim, so a transient failure never silently discards a selection.
 */
export function mcpRefsForPayload(
  selected: string[],
  registryNames: ReadonlySet<string>,
  registryLoaded: boolean,
): string[] {
  if (!registryLoaded) return selected;
  return selected.filter((name) => registryNames.has(name));
}

/**
 * Saved MCP selection seed: the persisted `mcp_refs` plus the removable
 * legacy inline entries an edit-mode conversion still surfaces
 * (REQ-LEGACY-002) — no invisible form data.
 */
export function deriveMcpRefNames(initialData?: AgentConfig): string[] {
  const names = [
    ...(initialData?.mcp_refs ?? []),
    ...(initialData?.mcp_servers ?? []).map((server) => server.name),
  ];
  return [...new Set(names.filter((name) => name.length > 0))];
}
