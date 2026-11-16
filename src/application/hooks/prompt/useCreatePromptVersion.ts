import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PromptVersion, PromptVersionCreateInput } from "@/domain/entities/prompt/prompt";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

export interface CreatePromptVersionMutationInput extends PromptVersionCreateInput {
  promptId: string;
}

/**
 * Appends the next immutable version and refreshes both the prompt list
 * (latest_version) and this prompt's version history (spec §CACHE-002).
 */
export function useCreatePromptVersion() {
  const queryClient = useQueryClient();
  return useMutation<PromptVersion, Error, CreatePromptVersionMutationInput>({
    mutationFn: ({ promptId, content }) => promptApi.createVersion(promptId, { content }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      await queryClient.invalidateQueries({
        queryKey: ["prompt-versions", variables.promptId],
      });
    },
  });
}
