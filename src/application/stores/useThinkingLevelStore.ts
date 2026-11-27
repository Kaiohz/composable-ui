import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ReasoningEffort } from "@/domain/entities/chat/chatRequest";

export type ThinkingLevel = "off" | ReasoningEffort;

interface ThinkingState {
  /** Persisted composer-level thinking selection (default: off). */
  level: ThinkingLevel;
  setLevel: (level: ThinkingLevel) => void;
}

/**
 * Composer thinking-level preference (chat thinking selector).
 *
 * Persisted in ``localStorage["composable-ui-thinking"]`` so the choice
 * survives reloads; the level travels with EVERY chat turn as
 * ``ChatRequest.reasoning_effort`` (off → field omitted, the backend applies
 * no reasoning payload).
 */
export const useThinkingLevelStore = create<ThinkingState>()(
  persist(
    (set) => ({
      level: "off",
      setLevel: (level) => set({ level }),
    }),
    {
      name: "composable-ui-thinking",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
