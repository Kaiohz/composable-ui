import type { ThreadSource } from "@/domain/entities/chat/threadSource";

export type { ThreadSource };

/**
 * Global trace summary row (spec §TRC-001). Constructed server-side with SQL
 * aggregations — the list never loads per-thread histories.
 */
export interface TraceSummary {
  thread_id: string;
  agent_name: string;
  source: ThreadSource;
  /** Thread creation timestamp. */
  started_at: string;
  /** Latest durable trace-event timestamp, null for an empty thread. */
  last_event_at: string | null;
  event_count: number;
  turn_count: number;
}

export interface TracePage {
  items: TraceSummary[];
  next_cursor: string | null;
}

/** Exact-match agent filter plus cursor pagination. */
export interface TraceListParams {
  /** Exact (case-sensitive) agent name filter, or undefined for all agents. */
  agentName?: string;
  /** Cursor from a previous page's `next_cursor`. */
  cursor?: string;
  /** Page size; default 50, hard cap 100. */
  limit?: number;
}
