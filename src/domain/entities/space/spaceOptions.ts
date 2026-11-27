import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import { isBuiltinAgent } from "@/domain/entities/agent/agentConfigMetadata";
import type { SpaceRecord } from "@/domain/entities/space/spaceRecord";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";

export interface SpaceOption {
  /** Agent slug of the space (`personal` for the Personal entry). */
  readonly slug: string;
  /** Displayable label (`Personal` for the Personal entry, else the slug). */
  readonly label: string;
}

const PERSONAL_OPTION: SpaceOption = { slug: PERSONAL_SLUG, label: "Personal" };

function isPlatformAgent(slug: string, catalog: readonly AgentConfigMetadata[]): boolean {
  return catalog.some((agent) => agent.name === slug);
}

/** Builtin rank reuses the shared agent-metadata rule (reserved-name fallback). */
function isBuiltinSpace(slug: string, catalog: readonly AgentConfigMetadata[]): boolean {
  const agent = catalog.find((candidate) => candidate.name === slug);
  return agent ? isBuiltinAgent(agent.name, agent.is_builtin) : false;
}

function byName(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Order the user's spaces for the selector (REQ-021/REQ-026): `Personal`
 * always first, platform agents next with builtin agents ahead, then external
 * (lazily-created) scopes. The spaces list is the source of entries; the
 * agent catalog only provides the ordering. The payload may still carry a
 * `personal` row (the backend cannot forbid it, REQ-019) — it is filtered so
 * the selector renders exactly ONE Personal entry, first; duplicates collapse.
 * When the catalog is unavailable every space falls back to the external
 * (alphabetical) group.
 */
export function buildSpaceOptions(
  spaces: readonly SpaceRecord[],
  agents: readonly AgentConfigMetadata[] | undefined,
): SpaceOption[] {
  const catalog = agents ?? [];
  const slugs = [
    ...new Set(
      spaces
        .map((record) => record.agent_slug.trim())
        .filter((slug) => slug && slug !== PERSONAL_SLUG),
    ),
  ];

  const platform = slugs
    .filter((slug) => isPlatformAgent(slug, catalog))
    .sort((a, b) => {
      const builtinFirst = Number(isBuiltinSpace(b, catalog)) - Number(isBuiltinSpace(a, catalog));
      return builtinFirst !== 0 ? builtinFirst : byName(a, b);
    });
  const external = slugs.filter((slug) => !isPlatformAgent(slug, catalog)).sort(byName);

  return [
    PERSONAL_OPTION,
    ...platform.map((slug) => ({ slug, label: slug }) satisfies SpaceOption),
    ...external.map((slug) => ({ slug, label: slug }) satisfies SpaceOption),
  ];
}
