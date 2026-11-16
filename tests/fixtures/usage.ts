/**
 * Shared factories for the LLM usage dashboard feature (spec: LLM Usage
 * Dashboard on /traces — Aggregations §26-§30). Mirrors the fixture
 * conventions of `tests/fixtures/registries.ts`.
 */
import type {
  LlmAgentUsageBreakdown,
  LlmModelUsageBreakdown,
  LlmUsageSummary,
} from "@/domain/entities/trace/llmUsageSummary";
import type { LlmUsageRun } from "@/domain/entities/trace/llmUsageRun";

export function createLlmAgentUsage(
  overrides: Partial<LlmAgentUsageBreakdown> = {},
): LlmAgentUsageBreakdown {
  return {
    agent_name: "digest-agent",
    input_tokens: 9_000,
    output_tokens: 3_000,
    total_tokens: 12_000,
    cost_usd: 0.36,
    // The backend always serialises `priced` (pydantic default False is not
    // None → never dropped by response_model_exclude_none). Only the MODEL
    // breakdown carries per-run counts today — hence no run_count here.
    priced: false,
    run_count: 7,
    ...overrides,
  };
}

export function createLlmModelUsage(
  overrides: Partial<LlmModelUsageBreakdown> = {},
): LlmModelUsageBreakdown {
  return {
    model_name: "claude-sonnet-4-5",
    provider: "anthropic",
    input_tokens: 11_000,
    output_tokens: 4_000,
    total_tokens: 15_000,
    cost_usd: 0.42,
    priced: true,
    ...overrides,
  };
}

export function createLlmUsageSummary(overrides: Partial<LlmUsageSummary> = {}): LlmUsageSummary {
  return {
    total_input_tokens: 12_000,
    total_output_tokens: 3_000,
    total_tokens: 15_000,
    total_cost_usd: 0.42,
    run_count: 10,
    error_count: 1,
    duration_ms_p50: 1_200,
    duration_ms_p95: 4_800,
    series: {
      by_agent: [createLlmAgentUsage()],
      by_model: [createLlmModelUsage()],
    },
    ...overrides,
  };
}

export function createLlmUsageRun(overrides: Partial<LlmUsageRun> = {}): LlmUsageRun {
  return {
    thread_id: "55555555-5555-4555-8555-555555555555",
    turn_id: "turn-1",
    agent_name: "digest-agent",
    model_name: "claude-sonnet-4-5",
    input_tokens: 1_200,
    output_tokens: 300,
    total_tokens: 1_500,
    cost_usd: 0.042,
    duration_ms: 4_400,
    started_at: "2026-11-15T12:00:00Z",
    priced: true,
    ...overrides,
  };
}
