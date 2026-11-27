import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";

/**
 * Memories namespace rules (scope-rag-memories spec REQ-012/REQ-022).
 *
 * The memories STORE (composable-agents) composes nothing: the namespace is
 * part of the client path — `/memories/{name}.md` in the flat personal
 * namespace and `/memories/{agent_slug}/{name}.md` inside an agent scope.
 */
export function memoriesNamespacePrefix(agentSlug: string): string {
  const slug = agentSlug.trim();
  return slug && slug !== PERSONAL_SLUG ? `/memories/${slug}/` : "/memories/";
}

/**
 * Whether `path` is a DIRECT child of the memories namespace `prefix` (one
 * segment, no deeper nesting).
 *
 * The composable-agents store listing is a plain `startswith` prefix filter
 * (`store_file/adapter.py`), so the flat `/memories/` namespace also returns
 * `/memories/{agent_slug}/{name}.md` rows — the UI must exclude them, mirroring
 * the memory-tools contract (`mcp_memory_tools.py` / the store adapter's
 * `_listing_name`: "deeper nesting never surfaces inside this scope — one
 * scope never merges into another", REQ-012).
 */
export function isDirectMemoryChild(prefix: string, path: string): boolean {
  if (!path.startsWith(prefix)) return false;
  const relative = path.slice(prefix.length);
  // `.md` suffix parity with the backend's `_listing_name`: a stray
  // non-markdown file directly under the namespace is not a memory either.
  return relative.length > 0 && !relative.includes("/") && relative.endsWith(".md");
}
