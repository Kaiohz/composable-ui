import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useStoreFilePreviews } from "@/application/hooks/store/useStoreFilePreviews";
import { parseFrontmatter } from "@/application/lib/frontmatter";
import SkillCard from "@/application/components/skill/SkillCard";
import { RESOURCE_CARD_GRID_CLASS } from "@/application/components/ui/resource-card";

interface SkillGridProps {
  readonly onCreateNew: () => void;
  readonly onConfigure: (skillName: string) => void;
}

const SKILLS_PREFIX = "/skills/";
const PREVIEW_CHARS = 1000;

export default function SkillGrid({ onCreateNew, onConfigure }: Readonly<SkillGridProps>) {
  const { data: previews, isLoading, error } = useStoreFilePreviews(SKILLS_PREFIX, PREVIEW_CHARS);

  const skillCards = useMemo(() => {
    return (previews ?? [])
      .filter((p) => p.path.endsWith("SKILL.md"))
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((item) => {
        const { data } = parseFrontmatter(item.preview);
        const name = data.name ?? deriveNameFromPath(item.path);
        const description = data.description ?? "";
        return { path: item.path, name, description };
      });
  }, [previews]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" data-od-id="skill-grid">
        <span
          className="spin mr-3 inline-block h-4 w-4 border-2 border-border border-t-accent"
          aria-hidden="true"
        />
        <p className="font-mono text-sm text-muted">Loading skills...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24" data-od-id="skill-grid">
        <p className="font-mono text-sm text-danger">Failed to load skills: {error.message}</p>
      </div>
    );
  }

  if (skillCards.length === 0) {
    return (
      <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="skill-grid">
        <SkillCreateButton onClick={onCreateNew} />
      </div>
    );
  }

  return (
    <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="skill-grid">
      {skillCards.map((card) => (
        // The card itself is the grid item: ResourceCard carries `min-w-0`
        // (review I4) and `h-full`, so track blowout and unequal heights are
        // both impossible.
        <SkillCard
          key={card.path}
          name={card.name}
          description={card.description}
          onConfigure={onConfigure}
        />
      ))}
      <SkillCreateButton onClick={onCreateNew} />
    </div>
  );
}

function deriveNameFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[1] : path;
}

function SkillCreateButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-od-id="skill-card-new"
      aria-label="Create a new skill"
      className="group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-surface/50 text-muted transition-[border-color,color] duration-base ease-standard hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:shadow-focus"
    >
      <span
        className="flex h-12 w-12 items-center justify-center border border-border bg-surface text-muted transition-colors group-hover:border-accent group-hover:text-accent"
        aria-hidden="true"
      >
        <Plus className="h-6 w-6" />
      </span>
      <span className="font-mono text-xs uppercase tracking-[0.1em]">New Skill</span>
    </button>
  );
}
