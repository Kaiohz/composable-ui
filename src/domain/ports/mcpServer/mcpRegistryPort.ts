import type {
  RegisteredMcpServer,
  McpServerInput,
  McpServerUpdateInput,
  McpServerValidationResult,
} from "@/domain/entities/mcpServer/registeredMcpServer";

/**
 * Port contract for the MCP server registry — the application layer depends
 * on this interface, never on the axios adapter.
 */
export interface McpRegistryPort {
  /** List all registered servers (masked). */
  list(): Promise<RegisteredMcpServer[]>;
  /** Get a single registered server (masked). */
  get(name: string): Promise<RegisteredMcpServer>;
  /** Get a single registered server with secrets revealed (plaintext). */
  reveal(name: string): Promise<RegisteredMcpServer>;
  /** Register a new server. Returns the masked entry. */
  create(input: McpServerInput): Promise<RegisteredMcpServer>;
  /**
   * Update an existing server (partial semantics: keys absent from the input
   * preserve the stored secrets). Returns the masked entry.
   */
  update(name: string, input: McpServerUpdateInput): Promise<RegisteredMcpServer>;
  /** Delete a registered server. */
  delete(name: string): Promise<void>;
  /** Validate (test connection) a server config; returns the tool count. */
  validate(input: McpServerInput): Promise<McpServerValidationResult>;
}
