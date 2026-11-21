import { Plus } from "lucide-react";
import { useAgents } from "@/application/hooks/agent/useAgents";
import { sortAgentsBuiltinFirst } from "@/domain/entities/agent/agentConfigMetadata";
import AgentCard from "@/application/components/agent/AgentCard";
import { RESOURCE_CARD_GRID_CLASS } from "@/application/components/ui/resource-card";

interface AgentGridProps {
  onCreateNew: () => void;
  onConfigure: (name: string) => void;
}

export default function AgentGrid({ onCreateNew, onConfigure }: Readonly<AgentGridProps>) {
  const { data: agents, isLoading, error } = useAgents();
  // Built-in assistant first (spec §REQ-045); stable within each group.
  const sortedAgents = sortAgentsBuiltinFirst(agents ?? []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" data-od-id="agent-grid">
        <span
          className="spin mr-3 inline-block h-4 w-4 border-2 border-border border-t-accent"
          aria-hidden="true"
        />
        <p className="font-mono text-sm text-muted">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24" data-od-id="agent-grid">
        <p className="font-mono text-sm text-danger">Failed to load agents: {error.message}</p>
      </div>
    );
  }

  return (
    <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="agent-grid">
      {sortedAgents.map((agent) => (
        // The card itself is the grid item: ResourceCard carries `min-w-0`
        // (review I4) and `h-full`, so track blowout and unequal heights are
        // both impossible.
        <AgentCard key={agent.name} agent={agent} onConfigure={onConfigure} />
      ))}

      <button
        type="button"
        onClick={onCreateNew}
        data-od-id="agent-card-new"
        className="group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-surface/50 text-muted transition-[border-color,color] duration-base ease-standard hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:shadow-focus"
      >
        <span
          className="flex h-12 w-12 items-center justify-center border border-border bg-surface text-muted transition-colors group-hover:border-accent group-hover:text-accent"
          aria-hidden="true"
        >
          <Plus className="h-6 w-6" />
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.1em]">New Agent Template</span>
      </button>
    </div>
  );
}
