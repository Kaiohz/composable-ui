import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ragApi } from "@/infrastructure/api/rag/ragApi";

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prefix, agentSlug }: { prefix: string; agentSlug?: string }) =>
      agentSlug ? ragApi.createFolder(prefix, agentSlug) : ragApi.createFolder(prefix),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rag", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["rag", "files"] });
    },
  });
}
