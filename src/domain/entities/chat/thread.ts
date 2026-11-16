import type { ThreadSource } from "@/domain/entities/chat/threadSource";
import type { Message } from "./message";

export type { ThreadSource };

export interface Thread {
  id: string;
  agent_name: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
  /** Immutable thread origin; `null` for payloads predating the field. */
  source: ThreadSource | null;
}
