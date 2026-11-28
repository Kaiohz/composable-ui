import { describe, expect, it } from "vitest";
import { agentScopeSlug, buildSpaceOptions } from "@/domain/entities/space/spaceOptions";
import type { SpaceRecord } from "@/domain/entities/space/spaceRecord";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";

function agent(name: string, builtin = false): AgentConfigMetadata {
  return { name, is_builtin: builtin } as AgentConfigMetadata;
}

function space(agentSlug: string): SpaceRecord {
  return { agent_slug: agentSlug, working_dirs: [], created_at: "", last_used_at: null };
}

describe("agentScopeSlug", () => {
  it("maps a valid slug name onto itself", () => {
    expect(agentScopeSlug("composable-ai-assistant")).toBe("composable-ai-assistant");
  });

  it("maps a name like the backend agent_scope_slug (lowercase, separators collapsed)", () => {
    expect(agentScopeSlug("Cold_Email_Writer")).toBe("cold-email-writer");
    expect(agentScopeSlug("  My.Agent ")).toBe("my-agent");
  });

  it("falls back deterministically for degenerate names and rejects the reserved scope", () => {
    expect(agentScopeSlug("___")).toBe("agent");
    expect(agentScopeSlug("personal")).toBeNull();
  });
});

describe("buildSpaceOptions", () => {
  it("lists every catalog agent (builtin first), external space records last — no Personal", () => {
    const options = buildSpaceOptions(
      [space("zzz-external"), space("zzz-external"), space("personal")],
      [agent("zzz-internal"), agent("composable-ai-assistant", true), agent("aaa-custom")],
    );
    expect(options.map((o) => o.slug)).toEqual([
      "composable-ai-assistant",
      "aaa-custom",
      "zzz-internal",
      "zzz-external",
    ]);
  });

  it("lists catalog agents even with a fully empty spaces payload (pre-provisioning case)", () => {
    const options = buildSpaceOptions(
      [],
      [agent("composable-ai-assistant", true), agent("agent-zeta")],
    );
    expect(options.map((o) => o.slug)).toEqual(["composable-ai-assistant", "agent-zeta"]);
  });

  it("degrades to external spaces only when the catalog is unavailable", () => {
    const options = buildSpaceOptions([space("opencode"), space("personal")], undefined);
    expect(options.map((o) => o.slug)).toEqual(["opencode"]);
  });
});
