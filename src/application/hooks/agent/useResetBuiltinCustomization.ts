import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agentApi } from "@/infrastructure/api/agent/agentApi";

export function useResetBuiltinCustomization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => agentApi.resetBuiltinCustomization(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent", name] });
    },
  });
}
