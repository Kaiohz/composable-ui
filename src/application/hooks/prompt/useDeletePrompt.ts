import { useMutation, useQueryClient } from "@tanstack/react-query";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

/** Deletes an unreferenced prompt; 409 Conflict while agents reference it. */
export function useDeletePrompt() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => promptApi.deletePrompt(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}
