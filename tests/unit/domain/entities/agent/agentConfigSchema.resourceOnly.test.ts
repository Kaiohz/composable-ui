/**
 * Spec: agent-resource-import.md — entities & schema validation reflecting the
 * `mcp_refs` / resource-only semantics (composable-ui).
 *
 * Contract (Step-1 Red: no product code exists yet):
 *  - REQ-MCP-003 / REQ-IMPORT-003: the shared agent YAML schema accepts
 *    `mcp_refs: ["server-name"]` as the persisted reference representation —
 *    the UI and the shared YAML contract need to parse such documents.
 *  - REQ-LEGACY-001: legacy agents with inline `model` / `system_prompt` /
 *    `mcp_servers` definitions remain readable (no breaking schema change for
 *    old documents).
 *  - Edge case: `model_ref` present together with a legacy `model` value is
 *    still a valid (legacy) document.
 *
 * Existing tests: tests/unit/domain/entities/agent/agentConfigSchema*.test.ts
 * pin exclusivity/refinement rules that remain valid; no assertion in those
 * files contradicts this spec.
 */
import { describe, it, expect } from "vitest";
import { parseAgentConfig } from "@/application/lib/yaml";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";

const REFS_ONLY_YAML = `
name: refs-agent
description: Resource-only agent
model_ref: 22222222-2222-4222-8222-222222222222
prompt_ref:
  id: 11111111-1111-4111-8111-111111111111
mcp_refs:
  - weather
  - github
tools: []
backend:
  type: store
  checkpoint_backend: memory
hitl:
  rules: {}
memory: []
skills: []
subagents: []
mcp_servers: []
debug: false
`;

describe("parseAgentConfig — mcp_refs / resource-only schema (agent-resource-import)", () => {
  it("REQ-MCP-003: parses a resource-only YAML carrying mcp_refs and returns the server references", () => {
    const parsed = parseAgentConfig(REFS_ONLY_YAML);

    expect(parsed.name).toBe("refs-agent");
    expect(parsed.model_ref).toBe("22222222-2222-4222-8222-222222222222");
    expect(parsed.prompt_ref).toEqual({ id: "11111111-1111-4111-8111-111111111111" });
    expect(parsed.mcp_refs).toEqual(["weather", "github"]);
  });

  it("REQ-LEGACY-001: legacy inline agents keep parsing — schema stays backward compatible", () => {
    const legacyYaml = `
name: legacy-agent
model: openai:gpt-4o
system_prompt: You are helpful
tools: []
backend:
  type: store
  checkpoint_backend: memory
hitl:
  rules: {}
memory: []
skills: []
subagents: []
mcp_servers:
  - name: legacy-local
    transport: stdio
    command: npx
    args: []
    headers: {}
    env: {}
debug: false
`;
    const parsed = parseAgentConfig(legacyYaml);
    expect(parsed.model).toBe("openai:gpt-4o");
    expect(parsed.system_prompt).toBe("You are helpful");
    expect(parsed.mcp_servers[0].name).toBe("legacy-local");
  });

  it("edge case: model_ref present with a legacy model string still parses (model_ref precedence preserved)", () => {
    const yaml = `
name: mixed-agent
model: openai:gpt-4o
model_ref: 22222222-2222-4222-8222-222222222222
prompt_ref:
  id: 11111111-1111-4111-8111-111111111111
tools: []
backend:
  type: store
  checkpoint_backend: memory
hitl:
  rules: {}
memory: []
skills: []
subagents: []
mcp_servers: []
debug: false
`;
    const parsed: AgentConfig = parseAgentConfig(yaml);
    expect(parsed.model_ref).toBe("22222222-2222-4222-8222-222222222222");
    expect(parsed.model).toBe("openai:gpt-4o");
  });
});
