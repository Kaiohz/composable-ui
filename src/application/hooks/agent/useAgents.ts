import { useQuery } from "@tanstack/react-query";
import { agentApi } from "@/infrastructure/api/agent/agentApi";

const QUERY_KEY = ["agents"] as const;

/**
 * Application hook — the platform agent catalog (`GET /api/v1/agents`,
 * composable-agents). The catalog changes rarely and is also mounted by the
 * shared SpaceSelector, so a `staleTime` avoids a refetch on every window
 * focus.
 */
export function useAgents() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => agentApi.listAgents(),
    staleTime: 30_000,
  });
}
