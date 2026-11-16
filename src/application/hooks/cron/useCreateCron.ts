import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CronCreateInput, CronSchedule } from "@/domain/entities/cron/cronSchedule";
import { cronApi } from "@/infrastructure/api/cron/cronApi";

/** Creates and validates a cron; the next occurrence is computed server-side. */
export function useCreateCron() {
  const queryClient = useQueryClient();
  return useMutation<CronSchedule, Error, CronCreateInput>({
    mutationFn: (input) => cronApi.createCron(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crons"] });
    },
  });
}
