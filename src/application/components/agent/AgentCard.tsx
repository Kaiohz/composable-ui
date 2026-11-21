import { Bot, Settings } from "lucide-react";
import type { AgentConfigMetadata } from "@/domain/entities/agent/agentConfigMetadata";
import { isBuiltinAgent } from "@/domain/entities/agent/agentConfigMetadata";
import { Badge } from "@/application/components/ui/badge";
import { Button } from "@/application/components/ui/button";
import {
  ResourceCard,
  ResourceCardDeleteButton,
  ResourceCardFooter,
} from "@/application/components/ui/resource-card";

interface AgentCardProps {
  readonly agent: AgentConfigMetadata;
  readonly onConfigure: (name: string) => void;
  readonly onDelete?: (name: string) => void;
}

/**
 * Agent card: the visual reference implemented THROUGH the shared resource
 * card pattern (spec unify-cards-modals CARD-001..CARD-008) so the treatment
 * stays defined once and every other resource surface inherits it.
 */
export default function AgentCard({ agent, onConfigure, onDelete }: Readonly<AgentCardProps>) {
  return (
    <ResourceCard
      odId={`agent-card-${agent.name}`}
      icon={Bot}
      title={agent.name}
      badges={
        isBuiltinAgent(agent.name, agent.is_builtin) && (
          <Badge variant="accent" data-od-id="agent-card-builtin-badge" className="shrink-0">
            built-in
          </Badge>
        )
      }
    >
      <p className="font-mono text-xs text-muted">{agent.model}</p>

      <ResourceCardFooter>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onConfigure(agent.name)}
          data-od-id={`agent-configure-${agent.name}`}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configure
        </Button>
        {onDelete && (
          <ResourceCardDeleteButton
            resourceName={agent.name}
            onActivate={() => onDelete(agent.name)}
          />
        )}
      </ResourceCardFooter>
    </ResourceCard>
  );
}
