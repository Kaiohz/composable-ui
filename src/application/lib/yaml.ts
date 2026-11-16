import yaml from "js-yaml";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import { agentConfigSchema } from "@/domain/entities/agent/agentConfigSchema";

type PlainRecord = Record<string, unknown>;

function cleanSubagent(sub: AgentConfig["subagents"][number]): PlainRecord {
  const result: PlainRecord = {
    name: sub.name,
    description: sub.description,
    tools: sub.tools,
    skills: sub.skills,
    mcp_servers: sub.mcp_servers,
  };

  if (sub.agent_ref) result.agent_ref = sub.agent_ref;
  if (sub.instructions) result.instructions = sub.instructions;
  if (sub.model) result.model = sub.model;
  if (sub.response_format && Object.keys(sub.response_format).length > 0) {
    result.response_format = sub.response_format;
  }

  return result;
}

function cleanMcpServer(server: AgentConfig["mcp_servers"][number]): PlainRecord {
  const result: PlainRecord = {
    name: server.name,
    transport: server.transport,
    args: server.args,
    headers: server.headers,
    env: server.env,
  };

  if (server.command) result.command = server.command;
  if (server.url) result.url = server.url;
  if (server.auth_token) result.auth_token = server.auth_token;

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
    mcp_servers: config.mcp_servers.map(cleanMcpServer),
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
