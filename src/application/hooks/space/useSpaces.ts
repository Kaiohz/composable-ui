import { useQuery } from "@tanstack/react-query";
import { spaceApi } from "@/infrastructure/api/space/spaceApi";

const QUERY_KEY = ["spaces"] as const;

/**
 * Application hook — bridges the UI with the spaces port (REQ-010, read-only).
 *
 * Fetches the caller's rag_spaces records for the shared space selector.
 * `retry: false` keeps the failure honest and fast: the selector degrades to
 * the error notice immediately (Personal scope keeps working, REQ-021), it
 * does not wait out the default retry backoff.
 */
export function useSpaces() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => spaceApi.listSpaces(),
    staleTime: 30_000,
    retry: false,
  });
}
