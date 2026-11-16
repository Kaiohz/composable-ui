import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CronRun } from "@/domain/entities/cron/cronSchedule";
import { cronApi } from "@/infrastructure/api/cron/cronApi";

/**
 * Triggers **Run now** (allowed while disabled) and refreshes both the cron
 * list (last-run summary) and the affected run history.
 */
export function useRunCron() {
  const queryClient = useQueryClient();
  return useMutation<CronRun, Error, string>({
    mutationFn: (cronId) => cronApi.runCron(cronId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crons"] });
      await queryClient.invalidateQueries({ queryKey: ["cron-runs"] });
    },
  });
}
