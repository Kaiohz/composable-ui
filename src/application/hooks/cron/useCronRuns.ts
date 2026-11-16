import { useQuery } from "@tanstack/react-query";
import type { CronRun } from "@/domain/entities/cron/cronSchedule";
import { cronApi } from "@/infrastructure/api/cron/cronApi";

export interface UseCronRunsOptions {
  /** Bounded client input; the backend caps run-history pages at 200. */
  limit?: number;
}

/** Run history for a cron, newest first (backend contract: `limit` only). */
export function useCronRuns(cronId: string | null, options: UseCronRunsOptions = {}) {
  return useQuery<CronRun[]>({
    queryKey: ["cron-runs", cronId, options.limit ?? null],
    queryFn: () => {
      if (!cronId) throw new Error("cronId is required");
      return cronApi.listRuns(cronId, { limit: options.limit });
    },
    enabled: !!cronId,
  });
}
