/**
 * Spec: prompts-models-crons-traces.md §CRN-003 (cron routes)
 * cronApi is the external adapter implementing ICronPort: CRUD, Run now and
 * paginated run history.
 *
 * Step-1 (Red): the adapter, port and module do not exist yet.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { cronApi } from "@/infrastructure/api/cron/cronApi";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import { createCronSchedule, createCronRun } from "../../../../fixtures/registries";

vi.mock("@/infrastructure/api/axiosInstance", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("cronApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists owned crons from GET /api/v1/crons", async () => {
    const crons = [createCronSchedule()];
    vi.mocked(apiClient.get).mockResolvedValue({ data: crons });

    const result = await cronApi.listCrons();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/crons");
    expect(result).toEqual(crons);
  });

  it("creates a cron via POST /api/v1/crons", async () => {
    const created = createCronSchedule();
    vi.mocked(apiClient.post).mockResolvedValue({ data: created });

    const payload = {
      name: "daily-digest",
      agent_name: "digest-agent",
      message: "Summarize the news",
      cron_expression: "0 9 * * *",
      timezone: "UTC",
      enabled: true,
    };

    const result = await cronApi.createCron(payload);

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/crons", payload);
    expect(result).toEqual(created);
  });

  it("reads a cron via GET /api/v1/crons/{id}", async () => {
    const cron = createCronSchedule();
    vi.mocked(apiClient.get).mockResolvedValue({ data: cron });

    const result = await cronApi.getCron(cron.id);

    expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/crons/${cron.id}`);
    expect(result).toEqual(cron);
  });

  it("edits fields including `enabled` via PATCH /api/v1/crons/{id}", async () => {
    const updated = createCronSchedule({ enabled: false });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: updated });

    const result = await cronApi.updateCron("cron-1", {
      enabled: false,
      timezone: "Europe/Paris",
    });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/crons/cron-1", {
      enabled: false,
      timezone: "Europe/Paris",
    });
    expect(result).toEqual(updated);
  });

  it("deletes via DELETE /api/v1/crons/{id}", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await cronApi.deleteCron("cron-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/crons/cron-1");
  });

  it("triggers Run now via POST /api/v1/crons/{id}/run", async () => {
    const run = createCronRun({ trigger: "manual", occurrence_at: null });
    vi.mocked(apiClient.post).mockResolvedValue({ data: run });

    const result = await cronApi.runCron("cron-1");

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/crons/cron-1/run");
    expect(result).toEqual(run);
  });

  it("fetches bounded run history newest first via GET /api/v1/crons/{id}/runs", async () => {
    const runs = [createCronRun()];
    vi.mocked(apiClient.get).mockResolvedValue({ data: runs });

    const result = await cronApi.listRuns("cron-1", { limit: 25 });

    // Backend contract: the runs endpoint accepts a bounded `limit` (1..200)
    // and no cursor.
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/crons/cron-1/runs", {
      params: { limit: 25 },
    });
    expect(result).toEqual(runs);
  });

  it("caps the run-history limit at the backend maximum of 200 and defaults to 50", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    await cronApi.listRuns("cron-1", { limit: 500 });
    expect(apiClient.get).toHaveBeenLastCalledWith("/api/v1/crons/cron-1/runs", {
      params: { limit: 200 },
    });

    await cronApi.listRuns("cron-1");
    expect(apiClient.get).toHaveBeenLastCalledWith("/api/v1/crons/cron-1/runs", {
      params: { limit: 50 },
    });
  });
});
