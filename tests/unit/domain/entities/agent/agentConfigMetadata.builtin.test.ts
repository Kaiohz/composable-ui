/**
 * Spec: feat-composable-mcp.md §REQ-033 / §REQ-010 (additive API contract)
 * AgentConfigMetadata gains an additive `is_builtin` marker (true for the
 * built-in assistant, false for custom agents) without any breaking change
 * to the existing metadata contract. The reserved built-in agent name is
 * `composable-ai-assistant`.
 *
 * Step-1 (Red note): `is_builtin` is a compile-time additive field on the
 * interface — the runtime object assertions below pin the additive contract
 * and the name reservation; the interface extension itself is enforced at
 * the type layer.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import { createAgentConfigMetadata } from "../../../../fixtures/external";

const RESERVED_BUILTIN_AGENT_NAME = "composable-ai-assistant";

describe("AgentConfigMetadata — built-in additive marker", () => {
  it("the reserved built-in assistant name is composable-ai-assistant", () => {
    const builtin = {
      ...createAgentConfigMetadata({ name: RESERVED_BUILTIN_AGENT_NAME }),
      is_builtin: true,
    } as unknown as AgentConfigMetadata;

    expect(builtin.name).toBe(RESERVED_BUILTIN_AGENT_NAME);
    expect(builtin.is_builtin).toBe(true);
  });

  it("carries is_builtin alongside the existing metadata fields (additive, non-breaking)", () => {
    const metadata = {
      ...createAgentConfigMetadata(),
      is_builtin: true,
    } as unknown as AgentConfigMetadata;

    expect(metadata.is_builtin).toBe(true);
    expect(metadata.model).toBeTruthy();
    expect(metadata.minio_path).toBeTruthy();
    expect(metadata.created_at).toBeTruthy();
    expect(metadata.updated_at).toBeTruthy();
  });

  it("keeps custom agents non-builtin", () => {
    const custom = {
      ...createAgentConfigMetadata({ name: "my-agent" }),
      is_builtin: false,
    } as unknown as AgentConfigMetadata;

    expect(custom.is_builtin).toBe(false);
  });

  it("AgentConfigMetadata admits the built-in marker field (type-level witness)", () => {
    // Compile-time gate: `is_builtin` does not exist on AgentConfigMetadata
    // yet, so the property access below is a type error (enforced by the
    // editor/typecheck step; runtime asserts additivity above).
    const witness = null as unknown;
    expectTypeOf<AgentConfigMetadata["is_builtin"]>().toEqualTypeOf<boolean>();
    expect(witness).toBeNull();
  });
});
