import { useEffect } from "react";
import { useSpaces } from "@/application/hooks/space/useSpaces";
import { useAgents } from "@/application/hooks/agent/useAgents";
import {
  buildSpaceOptions,
} from "@/domain/entities/space/spaceOptions";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";

/**
 * Default the space selection to the FIRST data option once the spaces /
 * agent-catalog payloads resolve: every data space is scoped user × agent
 * (user directive) — the personal namespace is a system-internal fallback and
 * is no longer a selectable surface. A user-managed non-personal selection is
 * never touched.
 */
export function useDefaultAgentScope(
  current: string,
  onChange: (slug: string) => void,
): { spacesPending: boolean } {
  const spacesQuery = useSpaces();
  const agentsQuery = useAgents();

  useEffect(() => {
    if (current !== PERSONAL_SLUG) return;
    const first = buildSpaceOptions(
      spacesQuery.data ?? [],
      agentsQuery.data,
    )[0];
    if (first) onChange(first.slug);
  }, [current, spacesQuery.data, agentsQuery.data, onChange]);

  return { spacesPending: spacesQuery.isPending || spacesQuery.isFetching };
}
