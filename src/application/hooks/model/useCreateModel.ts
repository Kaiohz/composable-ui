import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ModelConfiguration,
  ModelCreateInput,
} from "@/domain/entities/model/modelConfiguration";
import { modelApi } from "@/infrastructure/api/model/modelApi";

/** Creates a metadata-only model configuration (no credentials, ever). */
export function useCreateModel() {
  const queryClient = useQueryClient();
  return useMutation<ModelConfiguration, Error, ModelCreateInput>({
    mutationFn: (input) => modelApi.createModel(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
}
