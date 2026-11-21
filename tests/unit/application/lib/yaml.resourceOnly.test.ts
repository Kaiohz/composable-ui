/**
 * Spec: agent-resource-import.md — resource-only YAML serialization
 * (`src/application/lib/yaml.ts`).
 *
 * Contract (Step-1 Red: no product code exists yet):
 *  - REQ-MCP-003: the persisted agent configuration carries the identities of
 *    the selected servers (`mcp_refs: ["server-name"]`) — never their
 *    connection parameters or secrets.
 *  - REQ-LEGACY-004: the export of a resource-only agent exposes its
 *    references (`prompt_ref`, `model_ref`, `mcp_refs`), never resolved
 *    registry secrets.
 *  - The UI must not be able to reintroduce inline definitions: while
 *    references are present, the inline `model` / `system_prompt` /
 *    `system_prompt_file` / inline `mcp_servers` fields are dropped from the
 *    serialized YAML.
 *
 * Existing tests affected by this spec (implementation step must reconcile,
 * without weakening still-valid behavior):
 *  - tests/unit/application/lib/yaml.test.ts — "serializes a full config" and
 *    "parses valid YAML" embed inline `model`/`system_prompt` values; that is
 *    a LEGACY-compat shape (REQ-LEGACY-001 keeps legacy agents readable) and
 *    stays valid for parsing, but nothing in the UI submit path may emit it.
 */
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import {
  serializeAgentConfig,
  parseAgentConfig,
  agentConfigToYamlFile,
} from "@/application/lib/yaml";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import { BackendType } from "@/domain/entities/agent/agentConfig";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";

function refsOnlyConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "refs-agent",
    tools: [],
    backend: { type: BackendType.STORE, checkpoint_backend: "memory" },
    hitl: { rules: {} },
    memory: [],
    skills: [],
    subagents: [],
    mcp_servers: [],
    debug: false,
    ...overrides,
  } as AgentConfig;
}

const PROMPT_REF_ID = "11111111-1111-4111-8111-111111111111";
const MODEL_REF_ID = "22222222-2222-4222-8222-222222222222";

describe("serializeAgentConfig — resource-only serialization (agent-resource-import)", () => {
  it("REQ-MCP-003: keeps mcp_refs identities and drops every inline MCP connection parameter or secret", () => {
    const config = {
      ...refsOnlyConfig({
        mcp_servers: [
          {
            name: "weather",
            transport: "http",
            command: "npx",
            args: ["-y", "@mcp/weather"],
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer secret-header" },
            env: { TOKEN: "abc" },
            auth_token: "secret-token",
          },
        ],
      }),
      prompt_ref: { id: PROMPT_REF_ID },
      model_ref: MODEL_REF_ID,
      mcp_refs: ["weather", "github"],
    } as unknown as AgentConfig;

    const yamlText = serializeAgentConfig(config);
    const doc = yaml.load(yamlText) as Record<string, unknown>;

    // The persisted selection: identities only.
    expect(doc.mcp_refs).toEqual(["weather", "github"]);

    // The legacy key stays present but EMPTY (review C1: the shared YAML
    // contract and the backend mirrors declare `mcp_servers` mandatory) —
    // an empty list carries no definition, no connection parameter and no
    // secret.
    expect(doc).toHaveProperty("mcp_servers");
    expect(doc.mcp_servers).toEqual([]);
    expect(yamlText).not.toContain("auth_token");
    expect(yamlText).not.toContain("secret-token");
    expect(yamlText).not.toContain("https://example.com/mcp");
    expect(yamlText).not.toContain("secret-header");
    expect(yamlText).not.toContain("@mcp/weather");
    expect(yamlText).not.toContain("npx");
  });

  it("REQ-MCP-003: a resource-only document round-trips through serialize → parse", () => {
    const config = {
      ...refsOnlyConfig({
        mcp_servers: [
          {
            name: "weather",
            transport: "http",
            command: "npx",
            args: [],
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer secret-header" },
            env: {},
            auth_token: "secret-token",
          },
        ],
      }),
      prompt_ref: { id: PROMPT_REF_ID },
      model_ref: MODEL_REF_ID,
      mcp_refs: ["weather"],
    } as unknown as AgentConfig;

    const parsed = parseAgentConfig(serializeAgentConfig(config));

    // Produce → consume: the UI's own YAML satisfies the repo's shared
    // schema, and the identity selection survives the round-trip.
    expect(parsed.mcp_refs).toEqual(["weather"]);
    expect(parsed.model_ref).toBe(MODEL_REF_ID);
    expect(parsed.prompt_ref).toEqual({ id: PROMPT_REF_ID });
    expect(parsed.mcp_servers).toEqual([]);
  });

  it("REQ-LEGACY-004: the exported YAML of a resource-only agent keeps its references", async () => {
    const config = {
      ...refsOnlyConfig(),
      prompt_ref: { id: PROMPT_REF_ID, version: 2 },
      model_ref: MODEL_REF_ID,
      mcp_refs: ["weather"],
    } as unknown as AgentConfig;

    const file = agentConfigToYamlFile(config, "refs-agent.yaml");
    const raw = await file.text();
    const doc = yaml.load(raw) as Record<string, unknown>;

    expect(doc.prompt_ref).toEqual({ id: PROMPT_REF_ID, version: 2 });
    expect(doc.model_ref).toBe(MODEL_REF_ID);
    expect(doc.mcp_refs).toEqual(["weather"]);
  });

  it("with references present, the inline legacy fields are dropped from the serialized YAML", () => {
    // Guards an existing still-valid behavior of the ref-precedence contract:
    // even if stale drafts linger on the object, the emitted YAML carries
    // only the references.
    const config = {
      ...refsOnlyConfig({
        model: "openai:gpt-4o",
        system_prompt: "inline draft text",
        system_prompt_file: "/prompts/system.txt",
      }),
      prompt_ref: { id: PROMPT_REF_ID },
      model_ref: MODEL_REF_ID,
    } as AgentConfig;

    const doc = yaml.load(serializeAgentConfig(config)) as Record<string, unknown>;

    expect(doc).not.toHaveProperty("model");
    expect(doc).not.toHaveProperty("system_prompt");
    expect(doc).not.toHaveProperty("system_prompt_file");
    expect(doc.prompt_ref).toEqual({ id: PROMPT_REF_ID });
    expect(doc.model_ref).toBe(MODEL_REF_ID);
  });

  it("REQ-LEGACY-004: a legacy inline export stays readable but never carries a secret", () => {
    // REQ-LEGACY-001 keeps legacy agents readable — readability means the
    // non-secret connection parameters, never the plaintext credentials
    // stored by the MCP Registry (reviews C2/J1; the rule is domain-owned).
    const config = {
      ...refsOnlyConfig({
        model: "openai:gpt-4o",
        system_prompt: "You are helpful",
        mcp_servers: [
          {
            name: "legacy-stdio",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@mcp/filesystem"],
            headers: { Authorization: "Bearer legacy-secret" },
            env: { CACHE_DIR: "/tmp/cache", GITHUB_TOKEN: "ghp-top-level-secret" },
            auth_token: "legacy-plaintext-token",
          },
          {
            name: "legacy-http",
            transport: "http",
            args: [],
            url: "https://example.com/mcp",
            headers: {
              Accept: "application/json",
              Cookie: "session=abc",
              "X-Api-Key": "sk-key-123",
            },
            env: {},
            auth_token: null,
          },
        ],
      }),
    } as unknown as AgentConfig;

    const yamlText = serializeAgentConfig(config);
    const doc = yaml.load(yamlText) as Record<string, unknown>;

    // No credential material ever reaches the downloadable file: no auth
    // token, no secret headers, no credential-named env variable (J1).
    expect(yamlText).not.toContain("auth_token");
    expect(yamlText).not.toContain("legacy-plaintext-token");
    expect(yamlText).not.toContain("Authorization");
    expect(yamlText).not.toContain("legacy-secret");
    expect(yamlText).not.toContain("Cookie");
    expect(yamlText).not.toContain("session=abc");
    expect(yamlText).not.toContain("X-Api-Key");
    expect(yamlText).not.toContain("sk-key-123");
    expect(yamlText).not.toContain("GITHUB_TOKEN");
    expect(yamlText).not.toContain("ghp-top-level-secret");

    // Readability is preserved: identity, transport, non-secret connection
    // parameters and non-secret env/headers survive the export.
    const servers = doc.mcp_servers as Array<Record<string, unknown>>;
    expect(servers).toHaveLength(2);
    expect(servers[0]).toEqual({
      name: "legacy-stdio",
      transport: "stdio",
      args: ["-y", "@mcp/filesystem"],
      headers: {},
      env: { CACHE_DIR: "/tmp/cache" },
      command: "npx",
    });
    expect(servers[1]).toEqual({
      name: "legacy-http",
      transport: "http",
      args: [],
      headers: { Accept: "application/json" },
      env: {},
      url: "https://example.com/mcp",
    });

    // A legacy document still round-trips (its shape predates `mcp_refs`).
    expect(() => parseAgentConfig(yamlText)).not.toThrow();
  });

  it("REQ-LEGACY-004: a legacy subagent's inline MCP servers never carry a secret (review C3)", () => {
    // The SUB-AGENT path is held to the exact same domain redaction rule as
    // the top-level path (C3): credentials stay in the registry, the
    // readable legacy shape survives the export, and the document still
    // round-trips through the shared schema.
    const config = {
      ...refsOnlyConfig({
        model: "openai:gpt-4o",
        system_prompt: "You are helpful",
        subagents: [
          {
            name: "legacy-sub",
            description: "Legacy sub-agent",
            tools: [],
            skills: [],
            mcp_servers: [
              {
                name: "legacy-sub-server",
                transport: "http",
                args: ["-y", "@mcp/sub"],
                url: "https://sub.example.com/mcp",
                headers: { Authorization: "Bearer sub-secret", Accept: "application/json" },
                env: { SUB_TOKEN: "sub-env-secret", SUB_CACHE_DIR: "/tmp/sub" },
                auth_token: "sub-plaintext-token",
              },
              {
                name: "legacy-sub-stdio",
                transport: "stdio",
                command: "npx",
                args: [],
                headers: {},
                env: {},
              },
            ],
          },
        ],
      }),
    } as unknown as AgentConfig;

    const yamlText = serializeAgentConfig(config);
    const doc = yaml.load(yamlText) as Record<string, unknown>;

    expect(yamlText).not.toContain("auth_token");
    expect(yamlText).not.toContain("sub-plaintext-token");
    expect(yamlText).not.toContain("Authorization");
    expect(yamlText).not.toContain("sub-secret");
    expect(yamlText).not.toContain("SUB_TOKEN");
    expect(yamlText).not.toContain("sub-env-secret");

    // The readable legacy shape survives the redaction, on the sub path too.
    const subagent = (doc.subagents as Array<{ mcp_servers: Array<Record<string, unknown>> }>)[0];
    expect(subagent.mcp_servers).toEqual([
      {
        name: "legacy-sub-server",
        transport: "http",
        args: ["-y", "@mcp/sub"],
        headers: { Accept: "application/json" },
        env: { SUB_CACHE_DIR: "/tmp/sub" },
        url: "https://sub.example.com/mcp",
      },
      {
        name: "legacy-sub-stdio",
        transport: "stdio",
        args: [],
        headers: {},
        env: {},
        command: "npx",
      },
    ]);

    // The serialized legacy subagent still round-trips through the shared
    // schema (REQ-LEGACY-001 readability contract).
    const parsed = parseAgentConfig(yamlText);
    expect(parsed.subagents[0].name).toBe("legacy-sub");
    expect(parsed.subagents[0].mcp_servers[0].name).toBe("legacy-sub-server");
    expect(parsed.subagents[0].mcp_servers[0].auth_token).toBeUndefined();
  });
});

describe("serializeAgentConfig — legacy vs resource-only MCP discrimination against the real backend contract (BUG-001)", () => {
  // The real backend contract (composable-agents `AgentConfig.mcp_refs`):
  // `mcp_refs` is ALWAYS a list in responses — never null. A legacy agent's
  // stored configuration therefore carries `mcp_refs: []` TOGETHER with its
  // inline definitions, and the export must NOT drop them (BUG-001).
  const LEGACY_BACKEND_RESPONSE: AgentConfig = {
    name: "legacy-agent",
    model: "qa-legacy-inline-model",
    system_prompt: "Legacy inline prompt.",
    tools: [],
    backend: { type: BackendType.STORE, checkpoint_backend: "postgres" },
    hitl: { rules: {} },
    memory: [],
    skills: [],
    subagents: [
      {
        name: "legacy-sub",
        description: "Legacy sub-agent",
        tools: [],
        skills: [],
        mcp_servers: [
          {
            name: "legacy-sub-server",
            transport: McpTransportType.STDIO,
            command: "npx",
            args: ["-y", "@mcp/filesystem"],
            url: undefined,
            headers: { Authorization: "Bearer sub-plaintext-token", Accept: "application/json" },
            env: { GITHUB_TOKEN: "ghp-sub-secret", CACHE_DIR: "/tmp/sub" },
            auth_token: "sub-auth-token-value",
          },
        ],
      },
    ],
    mcp_servers: [
      {
        name: "legacy-secret-server",
        transport: McpTransportType.STDIO,
        command: "npx",
        args: ["-y", "@mcp/filesystem"],
        url: undefined,
        headers: { Authorization: "Bearer legacy-plaintext-token", Accept: "application/json" },
        env: { GITHUB_TOKEN: "ghp-legacy-secret", CACHE_DIR: "/tmp/cache" },
        auth_token: "legacy-auth-token-value",
      },
    ],
    mcp_refs: [],
    debug: false,
    is_builtin: false,
    is_customized: false,
  };

  it("the export of a legacy agent keeps its inline servers, redacted (top level AND sub-agent)", () => {
    const yamlText = serializeAgentConfig(LEGACY_BACKEND_RESPONSE);
    const doc = yaml.load(yamlText) as Record<string, unknown>;

    // The empty reference list is echoed (it is part of the stored agent)…
    expect(doc.mcp_refs).toEqual([]);
    // …and the inline definitions survive, redacted — the identity the
    // viewer displays is the identity the export hands back (BUG-001).
    const servers = doc.mcp_servers as Array<Record<string, unknown>>;
    expect(servers).toEqual([
      {
        name: "legacy-secret-server",
        transport: "stdio",
        args: ["-y", "@mcp/filesystem"],
        headers: { Accept: "application/json" },
        env: { CACHE_DIR: "/tmp/cache" },
        command: "npx",
      },
    ]);
    const sub = (doc.subagents as Array<{ mcp_servers: Array<Record<string, unknown>> }>)[0];
    expect(sub.mcp_servers).toEqual([
      {
        name: "legacy-sub-server",
        transport: "stdio",
        args: ["-y", "@mcp/filesystem"],
        headers: { Accept: "application/json" },
        env: { CACHE_DIR: "/tmp/sub" },
        command: "npx",
      },
    ]);

    // No credential material anywhere in the file (REQ-LEGACY-004).
    expect(yamlText).not.toContain("auth_token");
    expect(yamlText).not.toContain("legacy-plaintext-token");
    expect(yamlText).not.toContain("legacy-auth-token-value");
    expect(yamlText).not.toContain("sub-plaintext-token");
    expect(yamlText).not.toContain("sub-auth-token-value");
    expect(yamlText).not.toContain("Authorization");
    expect(yamlText).not.toContain("GITHUB_TOKEN");
    expect(yamlText).not.toContain("ghp-legacy-secret");
    expect(yamlText).not.toContain("ghp-sub-secret");
  });

  it("the exported legacy document round-trips through the shared schema", () => {
    const parsed = parseAgentConfig(serializeAgentConfig(LEGACY_BACKEND_RESPONSE));
    expect(parsed.mcp_refs).toEqual([]);
    expect(parsed.mcp_servers[0].name).toBe("legacy-secret-server");
    expect(parsed.mcp_servers[0].command).toBe("npx");
    expect(parsed.mcp_servers[0].auth_token).toBeUndefined();
    expect(parsed.mcp_servers[0].headers).toEqual({ Accept: "application/json" });
    expect(parsed.subagents[0].mcp_servers[0].name).toBe("legacy-sub-server");
    expect(parsed.subagents[0].mcp_servers[0].auth_token).toBeUndefined();
  });

  it("a resource-only agent serializes its explicit selection — including EMPTY — without inline data", () => {
    const resourceOnly = {
      ...refsOnlyConfig(),
      model_ref: "22222222-2222-4222-8222-222222222222",
      prompt_ref: { id: "11111111-1111-4111-8111-111111111111" },
      mcp_refs: [],
      mcp_servers: [],
    } as unknown as AgentConfig;
    const emptySelection = yaml.load(serializeAgentConfig(resourceOnly)) as Record<string, unknown>;
    expect(emptySelection.mcp_refs).toEqual([]);
    expect(emptySelection.mcp_servers).toEqual([]);

    const withSelection = {
      ...resourceOnly,
      mcp_refs: ["weather", "github"],
    } as AgentConfig;

    const doc = yaml.load(serializeAgentConfig(withSelection)) as Record<string, unknown>;
    // The non-empty selection: identities only, no inline definition.
    expect(doc.mcp_refs).toEqual(["weather", "github"]);
    expect(doc.mcp_servers).toEqual([]);
    // The exported document round-trips for both shapes.
    const parsed = parseAgentConfig(serializeAgentConfig(withSelection));
    expect(parsed.mcp_refs).toEqual(["weather", "github"]);
    expect(parsed.mcp_servers).toEqual([]);
    const parsedEmpty = parseAgentConfig(serializeAgentConfig(resourceOnly));
    expect(parsedEmpty.mcp_refs).toEqual([]);
    expect(parsedEmpty.mcp_servers).toEqual([]);
  });
});
