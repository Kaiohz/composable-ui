import { useMutation, useQueryClient } from "@tanstack/react-query";
import { modelApi } from "@/infrastructure/api/model/modelApi";

/** Deletes an unreferenced model; 409 Conflict while agents reference it. */
export function useDeleteModel() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => modelApi.deleteModel(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
}
