import { useQuery } from "@tanstack/react-query";
import { ragApi } from "@/infrastructure/api/rag/ragApi";

/**
 * List files under a scope-relative prefix. `agentSlug` selects the space via
 * the `X-Composable-Agent` header (absent → `personal`). The slug is part of
 * the query key, so switching spaces never serves another space's cache.
 */
export function useFiles(prefix?: string, recursive = false, agentSlug?: string) {
  return useQuery({
    queryKey: ["rag", "files", prefix, recursive, agentSlug],
    queryFn: () => {
      if (agentSlug) return ragApi.listFiles(prefix, recursive, agentSlug);
      return ragApi.listFiles(prefix, recursive);
    },
    enabled: prefix !== undefined,
    staleTime: 30_000,
  });
}
