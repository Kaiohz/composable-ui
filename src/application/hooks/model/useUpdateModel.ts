import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ModelConfiguration,
  ModelUpdateInput,
} from "@/domain/entities/model/modelConfiguration";
import { modelApi } from "@/infrastructure/api/model/modelApi";

export interface UpdateModelMutationInput extends ModelUpdateInput {
  id: string;
}

/** Edits model metadata; referencing agents pick it up on next invocation. */
export function useUpdateModel() {
  const queryClient = useQueryClient();
  return useMutation<ModelConfiguration, Error, UpdateModelMutationInput>({
    mutationFn: ({ id, ...patch }) => modelApi.updateModel(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
}
