import { Settings, Sparkles } from "lucide-react";
import { Button } from "@/application/components/ui/button";
import { ResourceCard, ResourceCardFooter } from "@/application/components/ui/resource-card";

interface SkillCardProps {
  readonly name: string;
  readonly description: string;
  readonly onConfigure: (skillPath: string) => void;
}

/**
 * Presentational card for a single skill, rendered through the shared
 * resource-card composition (spec unify-cards-modals CARD-001..010).
 */
export function SkillCard({ name, description, onConfigure }: Readonly<SkillCardProps>) {
  return (
    <ResourceCard odId={`skill-card-${name}`} icon={Sparkles} title={name}>
      <p className="line-clamp-3 font-mono text-xs text-muted">{description}</p>

      <ResourceCardFooter>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onConfigure(name)}
          data-od-id={`skill-configure-${name}`}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configure
        </Button>
      </ResourceCardFooter>
    </ResourceCard>
  );
}

export default SkillCard;
