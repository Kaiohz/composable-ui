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

const SLUG_MAX_LENGTH = 100;
const DEGENERATE_SLUG_FALLBACK = "agent";
const NON_SLUG_CHARS = /[^a-z0-9-]+/g;
const DASH_RUNS = /-{2,}/g;
const TRAILING_DASHES = /^-+|-+$/g;

/**
 * Map an agent NAME onto its deterministic scope SLUG — the client-side twin
 * of composable-agents' `agent_scope_slug` (documented contract): the backend
 * forwards this exact value as `X-Composable-Agent` for the bound agent, so
 * the UI must derive the SAME slug or its scoped listings would point at
 * another namespace. Idempotent and always charset-valid.
 *
 * A name whose mapping would land on the RESERVED `personal` scope has NO
 * client-side representation: the backend maps such names onto a
 * name-specific `personal-{hash}` slug, but inventing that digest twice is a
 * drift hazard, so the selector lists the space record instead (a pathological
 * literal-`"personal"` agent name is otherwise invisible in the pages —
 * review N-1).
 */
export function agentScopeSlug(name: string): string | null {
  const raw = (name ?? "").trim().toLowerCase();
  const collapsed = raw.replace(NON_SLUG_CHARS, "-").replace(DASH_RUNS, "-");
  const slug = collapsed.replace(TRAILING_DASHES, "").slice(0, SLUG_MAX_LENGTH);
  if (!slug) {
    return DEGENERATE_SLUG_FALLBACK;
  }
  return slug === PERSONAL_SLUG ? null : slug;
}

function catalogSlugs(
  catalog: readonly AgentConfigMetadata[],
): { slug: string; builtin: boolean }[] {
  const seen = new Set<string>();
  const entries: { slug: string; builtin: boolean }[] = [];
  for (const agent of catalog) {
    const slug = agentScopeSlug(agent.name);
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    entries.push({ slug, builtin: isBuiltinAgent(agent.name, agent.is_builtin) });
  }
  return entries;
}

/**
 * Order the selector options (REQ-021/REQ-026): `Personal` always first, then
 * the platform agents from the agent catalog (builtin agents ahead) — listed
 * whether or not their space record exists yet, because the scoped storage is
 * composed server-side from the `X-Composable-Agent` header and the lazily
 * created space rows must not hide an agent — then the remaining space
 * records (external, lazily-created scopes) alphabetically. Duplicates
 * collapse; a payload `personal` row (REQ-019) is filtered so exactly ONE
 * Personal entry renders, first.
 */
export function buildSpaceOptions(
  spaces: readonly SpaceRecord[],
  agents: readonly AgentConfigMetadata[] | undefined,
): SpaceOption[] {
  const catalog = agents ?? [];
  const catalogSet = new Set(catalogSlugs(catalog).map((entry) => entry.slug));

  const platform = catalogSlugs(catalog).sort((a, b) => {
    const builtinFirst = Number(b.builtin) - Number(a.builtin);
    return builtinFirst !== 0 ? builtinFirst : a.slug.localeCompare(b.slug);
  });

  const external = [
    ...new Set(
      spaces
        .map((record) => record.agent_slug.trim())
        .filter((slug) => slug && slug !== PERSONAL_SLUG && !catalogSet.has(slug)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return [
    PERSONAL_OPTION,
    ...platform.map(({ slug }) => ({ slug, label: slug }) satisfies SpaceOption),
    ...external.map((slug) => ({ slug, label: slug }) satisfies SpaceOption),
  ];
}
