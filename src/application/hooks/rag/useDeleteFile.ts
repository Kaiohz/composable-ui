import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ragApi } from "@/infrastructure/api/rag/ragApi";

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      objectName,
      workingDir,
      agentSlug,
    }: {
      objectName: string;
      workingDir?: string;
      agentSlug?: string;
    }) =>
      agentSlug
        ? ragApi.deleteFile(objectName, workingDir, agentSlug)
        : ragApi.deleteFile(objectName, workingDir),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rag", "files"] });
    },
  });
}
