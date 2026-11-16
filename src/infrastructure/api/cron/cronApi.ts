import type {
  CronCreateInput,
  CronRun,
  CronSchedule,
  CronUpdateInput,
} from "@/domain/entities/cron/cronSchedule";
import type { ICronPort } from "@/domain/ports/cron/cronPort";
import { apiClient } from "@/infrastructure/api/axiosInstance";

const MAX_RUNS_LIMIT = 200;
const DEFAULT_RUNS_LIMIT = 50;

/** Axios adapter for cron schedules, Run now and run history. */
export const cronApi: ICronPort = {
  async listCrons(): Promise<CronSchedule[]> {
    const response = await apiClient.get<CronSchedule[]>("/api/v1/crons");
    return response.data;
  },

  async createCron(input: CronCreateInput): Promise<CronSchedule> {
    const response = await apiClient.post<CronSchedule>("/api/v1/crons", input);
    return response.data;
  },

  async getCron(id: string): Promise<CronSchedule> {
    const response = await apiClient.get<CronSchedule>(`/api/v1/crons/${encodeURIComponent(id)}`);
    return response.data;
  },

  async updateCron(id: string, patch: CronUpdateInput): Promise<CronSchedule> {
    const response = await apiClient.patch<CronSchedule>(
      `/api/v1/crons/${encodeURIComponent(id)}`,
      patch,
    );
    return response.data;
  },

  async deleteCron(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/crons/${encodeURIComponent(id)}`);
  },

  async runCron(id: string): Promise<CronRun> {
    const response = await apiClient.post<CronRun>(`/api/v1/crons/${encodeURIComponent(id)}/run`);
    return response.data;
  },

  async listRuns(id: string, options?: { limit?: number }): Promise<CronRun[]> {
    // Backend contract: GET /api/v1/crons/{id}/runs accepts a bounded
    // `limit` (1..200) and returns the newest-first list; there is no cursor.
    const params: { limit: number } = {
      limit: Math.min(Math.max(options?.limit ?? DEFAULT_RUNS_LIMIT, 1), MAX_RUNS_LIMIT),
    };
    const response = await apiClient.get<CronRun[]>(
      `/api/v1/crons/${encodeURIComponent(id)}/runs`,
      { params },
    );
    return response.data;
  },
};
