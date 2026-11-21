/**
 * Spec: agent-resource-import.md — domain rules of the resource-only agent
 * selection (`src/domain/entities/agent/agentResourceSelection.ts`).
 *
 * Pure, framework-free coverage of the branches the review flagged as
 * untested (review I7):
 *  - REQ-FORM-001/002 / REQ-MCP-003 — the persisted payload carries the
 *    registry selections and NO legacy inline field;
 *  - REQ-LEGACY-002 — a stored inline value never pre-selects a registry
 *    resource; saved refs and legacy inline MCP names seed the selection;
 *  - the MCP drop contract — unregistered names are dropped from the payload
 *    once the registry list is loaded, but kept verbatim while it is not,
 *    with the count the form must surface to the user.
 */
import { describe, it, expect } from "vitest";
import {
  buildResourceOnlyValues,
  deriveMcpRefNames,
  deriveSourceState,
  mcpRefsForPayload,
} from "@/domain/entities/agent/agentResourceSelection";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import { BackendType } from "@/domain/entities/agent/agentConfig";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";

const PROMPT_REF_ID = "11111111-1111-4111-8111-111111111111";
const MODEL_REF_ID = "22222222-2222-4222-8222-222222222222";

function baseValues(
  overrides: Record<string, unknown> = {},
): Parameters<typeof buildResourceOnlyValues>[0] {
  return {
    name: "new-agent",
    tools: [],
    backend: { type: BackendType.STORE, checkpoint_backend: "memory" },
    hitl: { rules: {} },
    memory: [],
    skills: [],
    subagents: [],
    mcp_servers: [],
    debug: false,
    ...overrides,
  } as Parameters<typeof buildResourceOnlyValues>[0];
}

const LEGACY_INLINE_CONFIG: AgentConfig = {
  name: "legacy-agent",
  model: "openai:gpt-4o",
  system_prompt: "You are helpful",
  tools: [],
  backend: { type: BackendType.STORE, checkpoint_backend: "memory" },
  hitl: { rules: {} },
  memory: [],
  skills: [],
  subagents: [],
  mcp_servers: [
    {
      name: "legacy-local",
      transport: McpTransportType.STDIO,
      command: "npx",
      args: [],
      headers: {},
      env: {},
    },
  ],
  debug: false,
};

describe("buildResourceOnlyValues — the resource-only payload contract", () => {
  it("clears every legacy inline prompt/model field and serializes the selections", () => {
    const values = baseValues({
      model: "openai:gpt-4o",
      system_prompt: "You are helpful",
      system_prompt_file: "/prompts/system.txt",
    });
    const state = deriveSourceState({
      prompt_ref: { id: PROMPT_REF_ID, version: 2 },
      model_ref: MODEL_REF_ID,
      system_prompt: "You are helpful",
      model: "openai:gpt-4o",
      tools: [],
      backend: { type: BackendType.STORE, checkpoint_backend: "memory" },
      hitl: { rules: {} },
      memory: [],
      skills: [],
      subagents: [],
      mcp_servers: [],
      debug: false,
    } as AgentConfig);

    const merged = buildResourceOnlyValues(values, state, ["weather"]);

    expect(merged.model).toBeUndefined();
    expect(merged.system_prompt).toBeUndefined();
    expect(merged.system_prompt_file).toBeUndefined();
    // REQ-MCP-003: identities in, embedded configs out.
    expect(merged.mcp_refs).toEqual(["weather"]);
    expect(merged.mcp_servers).toEqual([]);
    expect(merged.prompt_ref).toEqual({ id: PROMPT_REF_ID, version: 2 });
    expect(merged.model_ref).toBe(MODEL_REF_ID);
  });

  it("maps Latest to a version-less prompt_ref and Pinned to the exact version", () => {
    const latestState = {
      promptId: PROMPT_REF_ID,
      versionMode: "latest" as const,
      promptVersion: undefined,
      modelRefId: "",
    };
    const latest = {
      ...baseValues(),
      ...buildResourceOnlyValues(latestState as never, latestState, []),
    };
    expect(latest.prompt_ref).toEqual({ id: PROMPT_REF_ID, version: undefined });

    const pinnedState = {
      promptId: PROMPT_REF_ID,
      versionMode: "pinned" as const,
      promptVersion: 2,
      modelRefId: "",
    };
    const pinned = buildResourceOnlyValues({ ...baseValues() } as never, pinnedState, []);
    expect(pinned.prompt_ref).toEqual({ id: PROMPT_REF_ID, version: 2 });

    // A Pinned mode without a chosen version falls back to Latest semantics.
    const missingVersion = { ...pinnedState, promptVersion: undefined };
    expect(
      buildResourceOnlyValues({ ...baseValues() } as never, missingVersion, []).prompt_ref,
    ).toEqual({ id: PROMPT_REF_ID, version: undefined });
  });
});

describe("deriveSourceState — selection seeding (REQ-LEGACY-002)", () => {
  it("seeds the registry selectors from stored references", () => {
    const state = deriveSourceState({
      prompt_ref: { id: PROMPT_REF_ID, version: 3 },
      model_ref: MODEL_REF_ID,
    } as AgentConfig);
    expect(state).toEqual({
      promptId: PROMPT_REF_ID,
      modelRefId: MODEL_REF_ID,
      versionMode: "pinned",
      promptVersion: 3,
    });

    const latest = deriveSourceState({
      prompt_ref: { id: PROMPT_REF_ID },
      model_ref: MODEL_REF_ID,
    } as unknown as AgentConfig);
    expect(latest.versionMode).toBe("latest");
    expect(latest.promptVersion).toBeUndefined();
  });

  it("never presents a legacy inline value as a registered resource", () => {
    const state = deriveSourceState(LEGACY_INLINE_CONFIG);
    expect(state.promptId).toBe("");
    expect(state.modelRefId).toBe("");
    expect(state.versionMode).toBe("latest");
    expect(state.promptVersion).toBeUndefined();
  });

  it("handles a missing config (create mode)", () => {
    expect(deriveSourceState(undefined)).toEqual({
      promptId: "",
      modelRefId: "",
      versionMode: "latest",
      promptVersion: undefined,
    });
  });
});

describe("mcpRefsForPayload — the drop contract (REQ-FORM-003)", () => {
  const registryNames = new Set(["weather", "github"]);

  it("keeps the selection verbatim while the registry list is unavailable", () => {
    // A transient loading/failed state never silently discards a selection.
    expect(mcpRefsForPayload(["weather", "unknown"], registryNames, false)).toEqual([
      "weather",
      "unknown",
    ]);
  });

  it("drops names missing from the loaded registry and keeps the registered ones", () => {
    expect(mcpRefsForPayload(["weather", "unknown", "github"], registryNames, true)).toEqual([
      "weather",
      "github",
    ]);
  });

  it("returns an empty selection untouched", () => {
    expect(mcpRefsForPayload([], registryNames, true)).toEqual([]);
  });
});

describe("deriveMcpRefNames — the saved-selection seed", () => {
  it("unions saved refs and legacy inline entries, deduplicating", () => {
    const config = {
      ...LEGACY_INLINE_CONFIG,
      mcp_refs: ["weather", "legacy-local"],
    } as AgentConfig;
    expect(deriveMcpRefNames(config)).toEqual(["weather", "legacy-local"]);
  });

  it("filters empty names and handles a missing config", () => {
    expect(
      deriveMcpRefNames({
        ...LEGACY_INLINE_CONFIG,
        mcp_servers: [{ ...LEGACY_INLINE_CONFIG.mcp_servers[0], name: "" }],
        mcp_refs: [],
      } as AgentConfig),
    ).toEqual([]);
    expect(deriveMcpRefNames(undefined)).toEqual([]);
  });
});
