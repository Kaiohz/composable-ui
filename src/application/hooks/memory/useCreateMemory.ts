import { useMutation, useQueryClient } from "@tanstack/react-query";
import { storeApi } from "@/infrastructure/api/store/storeApi";
import { memoriesNamespacePrefix } from "@/domain/entities/space/memoryPaths";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";

export interface CreateMemoryInput {
  name: string;
  content: string;
  /**
   * Target space agent slug (REQ-022): "personal" (or omitted) creates the
   * memory in the flat personal namespace, any other slug creates it inside
   * `/memories/{agent_slug}/`.
   */
  directory?: string;
}

const NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Create a new memory file at `/memories/{name}.md` (personal namespace) or
 * `/memories/{directory}/{name}.md` (agent scope) containing the provided
 * markdown content (no frontmatter for memories).
 *
 * Throws an error if a memory with the same name already exists in the target
 * space, to prevent silent overwrite of the existing content.
 */
export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, content, directory = PERSONAL_SLUG }: CreateMemoryInput) => {
      const trimmedName = name.trim().replace(/\.md$/, "");
      if (!NAME_PATTERN.test(trimmedName)) {
        throw new Error(
          `Invalid memory name "${trimmedName}": only letters, digits, dots, hyphens, and underscores allowed`,
        );
      }
      const path = `${memoriesNamespacePrefix(directory)}${trimmedName}.md`;
      const existing = await storeApi.getFile(path);
      if (existing !== null) {
        throw new Error(`A memory named "${trimmedName}" already exists`);
      }
      return storeApi.putFile(path, content ?? "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-files"] });
      queryClient.invalidateQueries({ queryKey: ["store-file-previews"] });
    },
  });
}
