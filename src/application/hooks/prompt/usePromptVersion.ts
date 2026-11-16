import { useQuery } from "@tanstack/react-query";
import type { PromptVersion } from "@/domain/entities/prompt/prompt";
import { promptApi } from "@/infrastructure/api/prompt/promptApi";

export interface UsePromptVersionOptions {
  enabled?: boolean;
}

/**
 * Full immutable content of ONE prompt version, fetched from
 * `GET /api/v1/prompts/{id}/versions/{version}` (spec §PR-004). The version
 * list endpoint returns summaries only (QA BUG-004) — the content viewer
 * must use this hook for the selected version.
 */
export function usePromptVersion(
  promptId: string | null,
  version: number | null,
  options: UsePromptVersionOptions = {},
) {
  return useQuery<PromptVersion>({
    queryKey: ["prompt-version", promptId, version],
    queryFn: () => {
      if (!promptId || version == null) throw new Error("promptId and version are required");
      return promptApi.getVersion(promptId, version);
    },
    enabled: !!promptId && version != null && (options.enabled ?? true),
  });
}
