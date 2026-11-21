import yaml from "js-yaml";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import { agentConfigSchema } from "@/domain/entities/agent/agentConfigSchema";
import {
  redactMcpServerForExport,
  resolveMcpExportSelection,
} from "@/domain/entities/agent/agentMcpSecrets";

type PlainRecord = Record<string, unknown>;

function cleanSubagent(sub: AgentConfig["subagents"][number]): PlainRecord {
  const result: PlainRecord = {
    name: sub.name,
    description: sub.description,
    tools: sub.tools,
    skills: sub.skills,
    // A subagent's inline MCP servers are credentials too: the SAME
    // domain-owned redaction rule as the top-level path applies — no
    // `auth_token`, no secret-bearing header, no credential env entry ever
    // reaches an exported file (REQ-LEGACY-004, review C3).
    mcp_servers: sub.mcp_servers.map(redactMcpServerForExport),
  };

  if (sub.agent_ref) result.agent_ref = sub.agent_ref;
  if (sub.instructions) result.instructions = sub.instructions;
  if (sub.model) result.model = sub.model;
  if (sub.response_format && Object.keys(sub.response_format).length > 0) {
    result.response_format = sub.response_format;
  }

  return result;
}

function cleanPromptRef(config: AgentConfig): PlainRecord | null {
  if (!config.prompt_ref) return null;
  const ref: PlainRecord = { id: config.prompt_ref.id };
  if (config.prompt_ref.version != null) {
    ref.version = config.prompt_ref.version;
  }
  return ref;
}

export function serializeAgentConfig(config: AgentConfig): string {
  const clean: PlainRecord = {
    name: config.name,
    tools: config.tools,
    backend: config.backend,
    hitl: config.hitl,
    memory: config.memory,
    skills: config.skills,
    subagents: config.subagents.map(cleanSubagent),
    debug: config.debug,
  };

  const promptRef = cleanPromptRef(config);
  if (promptRef) {
    // Registry-prompt mode wins: inline and file prompt fields are cleared
    // from the submitted YAML (spec §AGT-004.7, presence-based exclusivity).
    clean.prompt_ref = promptRef;
  } else {
    if (config.system_prompt) clean.system_prompt = config.system_prompt;
    if (config.system_prompt_file) clean.system_prompt_file = config.system_prompt_file;
  }

  if (config.model_ref) {
    // Catalog-model mode: `model_ref` takes precedence; the legacy custom
    // string is omitted from the submitted YAML (spec §AGT-003.4).
    clean.model_ref = config.model_ref;
  } else if (config.model) {
    clean.model = config.model;
  }

  // BUG-001: the LEGACY-inline vs resource-only discrimination is a domain
  // rule (resolveMcpExportSelection) — the discriminator is the presence of
  // inline DEFINITIONS, never the presence of `mcp_refs`, because the
  // backend returns `mcp_refs` as a list for every agent (legacy documents
  // included). Exported shape: redacted inline definitions when no
  // registered selection exists, the reference identities otherwise (the
  // inline list stays explicitly EMPTY so every produced document keeps
  // satisfying the mandatory-key contract mirrors and round-trips).
  const mcpExport = resolveMcpExportSelection(config.mcp_refs, config.mcp_servers);
  clean.mcp_servers = mcpExport.mcp_servers;
  if (mcpExport.mcp_refs != null) {
    clean.mcp_refs = mcpExport.mcp_refs;
  }

  if (config.description) {
    clean.description = config.description;
  }
  if (config.response_format && Object.keys(config.response_format).length > 0) {
    clean.response_format = config.response_format;
  }

  return yaml.dump(clean, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

export function parseAgentConfig(yamlString: string): AgentConfig {
  let raw: unknown;
  try {
    raw = yaml.load(yamlString);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse YAML: ${message}`, { cause: err });
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid YAML: expected an object");
  }

  return agentConfigSchema.parse(raw);
}

export function agentConfigToYamlFile(config: AgentConfig, filename?: string): File {
  const yamlContent = serializeAgentConfig(config);
  const safeName = config.name.replaceAll(/[^a-z0-9_-]/gi, "_");
  const name = filename ?? `${safeName}.yaml`;
  const file = new File([yamlContent], name, { type: "application/x-yaml" });
  // Some environments (older jsdom) ship a File without Blob#text; provide a
  // spec-compatible fallback so consumers can always read the contents back.
  const fileLike = file as File & { text?: () => Promise<string> };
  if (typeof fileLike.text !== "function") {
    Object.defineProperty(fileLike, "text", {
      value: () => Promise.resolve(yamlContent),
      configurable: true,
      writable: true,
    });
  }
  return file;
}
