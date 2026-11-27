import { useQuery } from "@tanstack/react-query";
import { ragApi } from "@/infrastructure/api/rag/ragApi";

/**
 * List folders under a scope-relative prefix (the backend returns
 * scope-relative folder prefixes). `agentSlug` selects the space via the
 * `X-Composable-Agent` header (absent → `personal`). The slug is part of the
 * query key, so switching spaces never serves another space's cache.
 */
export function useFolders(prefix?: string, agentSlug?: string) {
  return useQuery({
    queryKey: ["rag", "folders", prefix, agentSlug],
    queryFn: () => {
      if (agentSlug) return ragApi.listFolders(prefix, agentSlug);
      return ragApi.listFolders(prefix);
    },
    enabled: prefix !== undefined,
    staleTime: 30_000,
  });
}
