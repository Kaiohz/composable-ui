import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agentApi } from "@/infrastructure/api/agent/agentApi";

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => agentApi.deleteAgent(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      // Agent deletion cascade-deletes the agent's RAG space server-side
      // (REQ-018): refresh the spaces list so the selector no longer offers it.
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
}
