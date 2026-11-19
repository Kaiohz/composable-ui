/**
 * Shared factories for the local-registries feature (Prompts, Models, Crons,
 * Traces, thread source). Mirrors the fixture conventions of
 * `tests/fixtures/external.ts`.
 *
 * The structural types below describe the entity shapes required by the
 * spec (specs/prompts-models-crons-traces.md §PR-002, MDL-001, CRN-001/003,
 * TRC-001, SRC-001). When Step 2 lands `src/domain/entities/<feature>/*`,
 * the types should be re-imported from there and these factories kept as the
 * single fixture source of truth.
 */

import type { ThreadSource } from "@/domain/entities/chat/threadSource";

export type { ThreadSource };

export interface PromptMetadata {
  id: string;
  name: string;
  description: string | null;
  latest_version: number;
  created_at: string;
  updated_at: string;
}

export interface PromptVersionSummary {
  prompt_id: string;
  version: number;
  created_at: string;
}

/** Full immutable version payload (detail endpoint, `PromptVersionResponse`). */
export interface PromptVersion extends PromptVersionSummary {
  content: string;
}

export interface ModelConfiguration {
  id: string;
  name: string;
  provider: string;
  provider_model: string;
  base_url: string | null;
  created_at: string;
  updated_at: string;
}

export type CronRunStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type CronTrigger = "scheduled" | "manual";

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
  occurrence_at: string | null;
  thread_id: string | null;
  source: "cron" | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface TraceSummary {
  thread_id: string;
  agent_name: string;
  source: ThreadSource;
  started_at: string;
  last_event_at: string | null;
  event_count: number;
  turn_count: number;
}

export interface TracePage {
  items: TraceSummary[];
  next_cursor: string | null;
}

export function createPromptMetadata(overrides: Partial<PromptMetadata> = {}): PromptMetadata {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "support-triage",
    description: "Routes support tickets",
    latest_version: 2,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
    ...overrides,
  };
}

export function createPromptVersion(overrides: Partial<PromptVersion> = {}): PromptVersion {
  return {
    prompt_id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    content: "You are a support triage assistant.",
    created_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

/** Version-list row without content (list endpoint, `PromptVersionSummary`). */
export function createPromptVersionSummary(
  overrides: Partial<PromptVersionSummary> = {},
): PromptVersionSummary {
  return {
    prompt_id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    created_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

export function createModelConfiguration(
  overrides: Partial<ModelConfiguration> = {},
): ModelConfiguration {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Fast Haiku",
    provider: "openai",
    provider_model: "anthropic/claude-haiku-4.5",
    base_url: "https://api.example.com/v1",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
    ...overrides,
  };
}

export function createCronSchedule(overrides: Partial<CronSchedule> = {}): CronSchedule {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "daily-digest",
    agent_name: "digest-agent",
    message: "Summarize the daily news",
    cron_expression: "0 9 * * *",
    timezone: "UTC",
    enabled: true,
    next_run_at: "2026-11-17T09:00:00Z",
    last_run_status: "succeeded",
    last_run_at: "2026-11-16T09:00:00Z",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
    ...overrides,
  };
}

export function createCronRun(overrides: Partial<CronRun> = {}): CronRun {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    cron_id: "33333333-3333-4333-8333-333333333333",
    trigger: "scheduled",
    status: "succeeded",
    occurrence_at: "2026-11-16T09:00:00Z",
    thread_id: "55555555-5555-4555-8555-555555555555",
    source: "cron",
    started_at: "2026-11-16T09:00:00Z",
    finished_at: "2026-11-16T09:01:10Z",
    error: null,
    ...overrides,
  };
}

export function createTraceSummary(overrides: Partial<TraceSummary> = {}): TraceSummary {
  return {
    thread_id: "thread-123",
    agent_name: "test-agent",
    source: "chat",
    started_at: "2026-11-15T12:00:00Z",
    last_event_at: "2026-11-15T12:05:00Z",
    event_count: 14,
    turn_count: 3,
    ...overrides,
  };
}

export function createTracePage(overrides: Partial<TracePage> = {}): TracePage {
  return {
    items: [createTraceSummary()],
    next_cursor: null,
    ...overrides,
  };
}
