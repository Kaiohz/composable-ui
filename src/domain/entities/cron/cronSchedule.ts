/**
 * Cron schedule and durable run record (spec §CRN-001, §CRN-003).
 * `cron_expression` is a standard five-field expression (no seconds);
 * `timezone` is a valid IANA identifier. Run records carry trigger, terminal
 * status, thread linkage and a safe error summary.
 */
export type CronTrigger = "scheduled" | "manual";

export type CronRunStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";

export interface CronSchedule {
  id: string;
  name: string;
  agent_name: string;
  message: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  next_run_at: string | null;
  /** Wire format (backend `CronResponse`): flat last-run summary fields. */
  last_run_status: CronRunStatus | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CronRun {
  id: string;
  cron_id: string;
  trigger: CronTrigger;
  status: CronRunStatus;
  /** UTC occurrence for scheduled runs; null for manual runs. */
  occurrence_at: string | null;
  thread_id: string | null;
  /** Always "cron" when a thread exists. */
  source: "cron" | null;
  started_at: string | null;
  finished_at: string | null;
  /** Safe summary — never contains authentication tokens or secrets. */
  error: string | null;
}

export interface CronCreateInput {
  name: string;
  agent_name: string;
  message: string;
  cron_expression: string;
  timezone: string;
  enabled?: boolean;
}

export interface CronUpdateInput {
  name?: string;
  agent_name?: string;
  message?: string;
  cron_expression?: string;
  timezone?: string;
  enabled?: boolean;
}
