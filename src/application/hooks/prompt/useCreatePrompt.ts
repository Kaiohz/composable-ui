import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PromptCreateInput, PromptMetadata } from "@/domain/entities/prompt/prompt";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

/** Creates a prompt together with its immutable version 1. */
export function useCreatePrompt() {
  const queryClient = useQueryClient();
  return useMutation<PromptMetadata, Error, PromptCreateInput>({
    mutationFn: (input) => promptApi.createPrompt(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}
