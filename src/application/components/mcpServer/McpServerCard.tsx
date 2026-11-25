import { Pencil, Server } from "lucide-react";
import type { RegisteredMcpServer } from "@/domain/entities/mcpServer/registeredMcpServer";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";
import { Badge } from "@/application/components/ui/badge";
import { Button } from "@/application/components/ui/button";
import {
  ResourceCard,
  ResourceCardDeleteButton,
  ResourceCardFooter,
} from "@/application/components/ui/resource-card";

interface McpServerCardProps {
  readonly server: RegisteredMcpServer;
  readonly onEdit: (server: RegisteredMcpServer) => void;
  readonly onDelete: (name: string) => void;
}

/**
 * Presentational card for a single registered MCP server, rendered through
 * the shared resource-card composition (spec unify-cards-modals
 * CARD-001..010): icon block, normalized title/badge row, content and
 * top-separated footer. Renders a source-type badge (External vs OpenAPI),
 * the auth-mode badge (BUG-002 — OAuth2 vs API key vs UNKNOWN when the echo
 * is absent, M-3) and, for OpenAPI servers, the spec URL.
 */
export function McpServerCard({ server, onEdit, onDelete }: Readonly<McpServerCardProps>) {
  const isHttp = server.transport === McpTransportType.HTTP;
  const isOpenapi = server.source_type === "openapi";
  const sourceTypeLabel = isOpenapi ? "OpenAPI" : "External";
  const displayedUrl = isOpenapi && server.openapi_url ? server.openapi_url : (server.url ?? "—");
  /**
   * BUG-002: the registry persists and echoes `auth_mode` — surface it at a
   * glance: a `user_token` server forwards the CONNECTED USER's credential
   * (OAuth2) while a `"headers"` server sends a static secret (API key). An
   * absent echo stays UNKNOWN (never guessed to `"headers"` — M-3
   * defense-in-depth), flagged as a rollout-skew signal worth noticing.
   */
  const authModeBadge =
    server.auth_mode === "user_token"
      ? { label: "OAuth2", variant: "accent" as const }
      : server.auth_mode === "headers"
        ? { label: "API key", variant: "default" as const }
        : { label: "Unknown", variant: "warn" as const };

  return (
    <ResourceCard
      odId={`mcp-server-card-${server.name}`}
      icon={Server}
      title={server.name}
      badges={
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={isOpenapi ? "accent" : "default"} data-od-id="mcp-source-type-badge">
            {sourceTypeLabel}
          </Badge>
          <Badge variant={isHttp ? "accent" : "default"}>{server.transport}</Badge>
          <Badge variant={authModeBadge.variant} data-od-id="mcp-auth-mode-badge">
            {authModeBadge.label}
          </Badge>
        </div>
      }
    >
      <p className="min-w-0 truncate font-mono text-xs text-muted" title={displayedUrl}>
        {displayedUrl}
      </p>

      <p className="font-mono text-xs text-fg-2">{server.tool_count} tools</p>
      <p className="font-mono text-xs text-muted">Created {server.created_at.slice(0, 10)}</p>

      <ResourceCardFooter>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onEdit(server)}
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <ResourceCardDeleteButton
          resourceName={server.name}
          onActivate={() => onDelete(server.name)}
        />
      </ResourceCardFooter>
    </ResourceCard>
  );
}

export default McpServerCard;
