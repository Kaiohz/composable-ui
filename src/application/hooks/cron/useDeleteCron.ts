import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cronApi } from "@/infrastructure/api/cron/cronApi";

/** Deletes a cron; future scheduling stops immediately. */
export function useDeleteCron() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => cronApi.deleteCron(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crons"] });
    },
  });
}
