import { useMutation } from "@tanstack/react-query";
import { mcpRegistryApi } from "@/infrastructure/api/mcpServer/mcpRegistryApi";
import type { McpServerValidateInput } from "@/domain/entities/mcpServer/registeredMcpServer";

/**
 * Validate (test connection) an MCP server config. Returns the tool count on
 * success. Does NOT invalidate the registry — validation is read-only.
 *
 * The create-mode payload is a full candidate (`server_id` absent); the
 * edit-mode payload carries `server_id`, so the backend merges the STORED
 * entry's secrets into the candidate before probing (BUG-001 — the masked
 * projection never carries the stored credential).
 */
export function useValidateMcpServer() {
  return useMutation({
    mutationFn: (input: McpServerValidateInput) => mcpRegistryApi.validate(input),
  });
}
