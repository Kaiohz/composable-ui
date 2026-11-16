import { useQuery } from "@tanstack/react-query";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

/** List of the authenticated user's prompt metadata. */
export function usePrompts() {
  return useQuery({
    queryKey: ["prompts"],
    queryFn: () => promptApi.listPrompts(),
  });
}
