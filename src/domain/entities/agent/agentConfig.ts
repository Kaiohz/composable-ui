import type { McpServerConfig } from "./mcpServerConfig";

export enum BackendType {
  STORE = "store",
}

export interface BackendConfig {
  type: BackendType;
  checkpoint_backend: "memory" | "postgres";
}

export interface InterruptRule {
  before?: boolean;
  after?: boolean;
}

export interface HITLConfig {
  rules: Record<string, boolean | InterruptRule>;
}

/**
 * Registry prompt reference (spec §AGT-001). `version` omitted resolves the
 * prompt's Latest version; a pinned positive integer resolves exactly that
 * immutable version.
 */
export interface PromptRef {
  id: string;
  version?: number;
}

export interface SubAgentConfig {
  name: string;
  description: string;
  agent_ref?: string;
  instructions?: string;
  model?: string;
  tools: string[];
  skills: string[];
  mcp_servers: McpServerConfig[];
  response_format?: Record<string, unknown>;
}

export interface AgentConfig {
  name: string;
  description?: string;
  /** Legacy custom provider model string. Ignored when `model_ref` is valid. */
  model?: string;
  system_prompt?: string;
  system_prompt_file?: string;
  /** Registry prompt reference — mutually exclusive with the two above. */
  prompt_ref?: PromptRef;
  /** Catalog model UUID — takes precedence over the legacy `model` string. */
  model_ref?: string;
  /**
   * Optional display shortcuts. The backend config payload carries ids
   * only; these fields are not part of the response contract. The viewer
   * resolves names from the user's registries and falls back to these
   * legacy fields when present (never rendering a raw UUID as a name).
   */
  prompt_name?: string | null;
  catalog_model_name?: string | null;
  catalog_model_provider_model?: string | null;
  /**
   * Registered MCP server identities — the resource-only selection
   * (spec agent-resource-import REQ-MCP-003). The persisted configuration
   * carries only the names; the runner resolves them against the user's
   * MCP Registry. When present, inline `mcp_servers` definitions are
   * never re-serialized.
   */
  mcp_refs?: string[];
  tools: string[];
  backend: BackendConfig;
  hitl: HITLConfig;
  memory: string[];
  skills: string[];
  subagents: SubAgentConfig[];
  mcp_servers: McpServerConfig[];
  response_format?: Record<string, unknown>;
  debug: boolean;
  /** Backend overlay marker: `true` for the virtual built-in assistant. */
  is_builtin?: boolean;
  /** `true` when the built-in assistant resolves to the user's override. */
  is_customized?: boolean;
}
