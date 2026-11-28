import { useState } from "react";
import { Plus } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import MemoryGrid from "@/application/components/memory/MemoryGrid";
import CreateMemoryDialog from "@/application/components/memory/CreateMemoryDialog";
import MemoryViewer from "@/application/components/memory/MemoryViewer";
import SpaceSelector from "@/application/components/shared/SpaceSelector";
import { useDefaultAgentScope } from "@/application/hooks/space/useDefaultAgentScope";
import { useStoreFiles } from "@/application/hooks/store/useStoreFiles";
import { isDirectMemoryChild, memoriesNamespacePrefix } from "@/domain/entities/space/memoryPaths";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";
import { Badge } from "@/application/components/ui/badge";
import { Button } from "@/application/components/ui/button";

export default function MemoriesPage() {
  const [spaceSlug, setSpaceSlug] = useState(PERSONAL_SLUG);
  // User × agent scoping: personal is not selectable — default to the first
  // data space once the payloads resolve.
  useDefaultAgentScope(spaceSlug, setSpaceSlug);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewerMemory, setViewerMemory] = useState<string | null>(null);
  // REQ-022: the grid and every page action operate within the selected
  // space — flat `/memories/` for Personal, `/memories/{agent_slug}/` for an
  // agent scope.
  const memoriesPrefix = memoriesNamespacePrefix(spaceSlug);
  const { data: files } = useStoreFiles(memoriesPrefix);
  // The store listing is a startswith filter: count only DIRECT children of
  // this namespace so the badge matches the grid (N2 parity).
  const total = (files ?? []).filter((file) =>
    isDirectMemoryChild(memoriesPrefix, file.path),
  ).length;

  return (
    <AppShell>
      <div
        className="memories-view flex flex-1 flex-col gap-6 overflow-y-auto bg-bg p-4 md:p-8"
        data-od-id="memories-view"
      >
        {/* Space selector header bar (REQ-022/REQ-026): above the grid. */}
        <SpaceSelector value={spaceSlug} onChange={setSpaceSlug} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md font-body text-sm text-muted">
            Manage markdown memory files within the selected space. Each memory lives at{" "}
            <span className="font-mono text-fg-2">{memoriesPrefix}&lt;name&gt;.md</span> and can be
            referenced by agents.
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="default" data-od-id="memory-count">
              {total} memor{total === 1 ? "y" : "ies"}
            </Badge>
            <Button
              type="button"
              variant="default"
              onClick={() => setCreateDialogOpen(true)}
              data-od-id="create-memory"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Memory
            </Button>
          </div>
        </div>

        <MemoryGrid
          memoriesPrefix={memoriesPrefix}
          onCreateNew={() => setCreateDialogOpen(true)}
          // The grid hands over the EXACT stored path — no basename
          // reconstruction, so a same-named memory of another space can never
          // be opened or deleted by mistake (N2).
          onConfigure={setViewerMemory}
        />
      </div>

      <CreateMemoryDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        spaceSlug={spaceSlug}
      />
      {viewerMemory && (
        <MemoryViewer
          memoryPath={viewerMemory}
          open
          onOpenChange={(open) => {
            if (!open) setViewerMemory(null);
          }}
        />
      )}
    </AppShell>
  );
}
