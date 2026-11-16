import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CronSchedule, CronUpdateInput } from "@/domain/entities/cron/cronSchedule";
import { cronApi } from "@/infrastructure/api/cron/cronApi";

export interface UpdateCronMutationInput extends CronUpdateInput {
  id: string;
}

/** Edits cron fields (including `enabled`); running executions are unaffected. */
export function useUpdateCron() {
  const queryClient = useQueryClient();
  return useMutation<CronSchedule, Error, UpdateCronMutationInput>({
    mutationFn: ({ id, ...patch }) => cronApi.updateCron(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crons"] });
    },
  });
}
