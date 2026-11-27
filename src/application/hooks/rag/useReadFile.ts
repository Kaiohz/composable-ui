import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ragFileContentApi } from "@/infrastructure/api/rag/ragFileContentApi";

export function useReadFile(agentSlug?: string) {
  return useMutation({
    mutationFn: (filePath: string) => {
      if (agentSlug) return ragFileContentApi.readFile(filePath, agentSlug);
      return ragFileContentApi.readFile(filePath);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to read file content");
    },
  });
}
