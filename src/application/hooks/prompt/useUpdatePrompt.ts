import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PromptMetadata, PromptMetadataUpdateInput } from "@/domain/entities/prompt/prompt";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

export interface UpdatePromptMutationInput extends PromptMetadataUpdateInput {
  id: string;
}

/** Metadata-only edit; never creates a version. */
export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation<PromptMetadata, Error, UpdatePromptMutationInput>({
    mutationFn: ({ id, ...patch }) => promptApi.updatePrompt(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}
