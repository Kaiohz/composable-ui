import { useQuery } from "@tanstack/react-query";
import type { PromptVersionSummary } from "@/domain/entities/prompt/prompt";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

export interface UsePromptVersionsOptions {
  enabled?: boolean;
}

/**
 * Immutable version history for a prompt, ordered numerically. Rows are
 * summaries (version number + timestamp only, QA BUG-004); the selected
 * version's immutable content is fetched through `usePromptVersion`.
 */
export function usePromptVersions(promptId: string | null, options: UsePromptVersionsOptions = {}) {
  return useQuery<PromptVersionSummary[]>({
    queryKey: ["prompt-versions", promptId],
    queryFn: () => {
      if (!promptId) throw new Error("promptId is required");
      return promptApi.listVersions(promptId);
    },
    enabled: !!promptId && (options.enabled ?? true),
  });
}
