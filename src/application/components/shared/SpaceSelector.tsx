import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/application/components/ui/select";
import { useSpaces } from "@/application/hooks/space/useSpaces";
import { useAgents } from "@/application/hooks/agent/useAgents";
import { buildSpaceOptions, type SpaceOption } from "@/domain/entities/space/spaceOptions";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";

const SPACE_LABEL_ID = "space-selector-label";
const SPACE_LABEL = "Space (user × agent scope)";

interface SpaceSelectorProps {
  /** Currently selected agent slug (`personal` for Personal). Controlled. */
  readonly value: string;
  /** Reports the newly selected agent slug (`personal` for Personal). */
  readonly onChange: (agentSlug: string) => void;
}

/**
 * Shared space selector (REQ-026) — ONE component for the RAG and Memories
 * pages, rendered as a header bar above the explorer/grid. Built exclusively
 * on the existing design-system select primitives and tokens: it lists the
 * caller's platform agents (from `GET /api/v1/agents`, builtin-first) plus
 * every extra space record (`GET /api/v1/spaces`) — NO Personal entry (the
 * personal namespace is a system-internal fallback). Degrades to an error
 * notice (selector intact, catalog agents still listed) when the spaces
 * endpoint fails.
 */
export default function SpaceSelector({ value, onChange }: Readonly<SpaceSelectorProps>) {
  const spacesQuery = useSpaces();
  const agentsQuery = useAgents();

  const options = useMemo(
    () => buildSpaceOptions(spacesQuery.data ?? [], agentsQuery.data),
    [spacesQuery.data, agentsQuery.data],
  );
  // A selected slug that is no longer in the payload (agent deleted, spaces
  // failed mid-session) would otherwise render an EMPTY Radix trigger — keep
  // it visible as an explicit entry instead of a blank control. EXCEPT the
  // personal slug: it is not a selectable surface anymore (system-internal
  // fallback — it must never re-appear in the list).
  const selectedSpaceExists = options.some((option) => option.slug === value);
  let listOptions: readonly SpaceOption[] = options;
  if (!selectedSpaceExists && value && value !== PERSONAL_SLUG) {
    listOptions = [...options, { slug: value, label: value }];
  }

  function handleChange(agentSlug: string) {
    if (agentSlug && agentSlug !== value) onChange(agentSlug);
  }

  return (
    <div
      data-od-id="space-selector"
      className="flex flex-wrap items-center gap-3 border border-border bg-surface p-3"
    >
      <span id={SPACE_LABEL_ID} className="sr-only">
        {SPACE_LABEL}
      </span>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger
          aria-label={SPACE_LABEL}
          aria-labelledby={SPACE_LABEL_ID}
          data-od-id="space-selector-trigger"
          className="w-64 max-w-full font-mono text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {listOptions.map((option) => (
            <SelectItem key={option.slug} value={option.slug}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {spacesQuery.isError && (
        <span className="font-mono text-xs text-danger" role="alert">
          Failed to load spaces — the agent catalog stays available.
        </span>
      )}
    </div>
  );
}
