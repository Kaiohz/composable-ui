import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agentApi } from "@/infrastructure/api/agent/agentApi";

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, yamlFile }: { name: string; yamlFile: File }) =>
      agentApi.createAgent(name, yamlFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      // Agent creation provisions the agent's RAG space server-side (REQ-018):
      // refresh the spaces list so the selector shows the new scope.
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
}
