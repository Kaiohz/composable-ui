import type {
  CronCreateInput,
  CronRun,
  CronSchedule,
  CronUpdateInput,
} from "@/domain/entities/cron/cronSchedule";

/** Port for cron schedules and their durable run history (spec §CRN-003). */
export interface ICronPort {
  listCrons(): Promise<CronSchedule[]>;
  createCron(input: CronCreateInput): Promise<CronSchedule>;
  getCron(id: string): Promise<CronSchedule>;
  updateCron(id: string, patch: CronUpdateInput): Promise<CronSchedule>;
  deleteCron(id: string): Promise<void>;
  /** Trigger **Run now**; permitted while the cron is disabled. */
  runCron(id: string): Promise<CronRun>;
  /** Run history, newest first, bounded by `limit` (backend maximum 200). */
  listRuns(id: string, options?: { limit?: number }): Promise<CronRun[]>;
}
