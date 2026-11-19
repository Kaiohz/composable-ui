import { useState } from "react";
import { toast } from "sonner";
import { Download, Pencil, Trash2 } from "lucide-react";
import { useAgentConfig } from "@/application/hooks/agent/useAgentConfig";
import { isBuiltinAgent } from "@/domain/entities/agent/agentConfigMetadata";
import { useUpdateAgent } from "@/application/hooks/agent/useUpdateAgent";
import { useDeleteAgent } from "@/application/hooks/agent/useDeleteAgent";
import { usePrompts } from "@/application/hooks/prompt/usePrompts";
import { useModels } from "@/application/hooks/model/useModels";
import { serializeAgentConfig, agentConfigToYamlFile } from "@/application/lib/yaml";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import type { AgentConfigFormData } from "@/domain/entities/agent/agentConfigSchema";
import type { PromptMetadata } from "@/domain/entities/prompt/prompt";
import type { ModelConfiguration } from "@/domain/entities/model/modelConfiguration";
import { Badge } from "@/application/components/ui/badge";
import ToolTag from "@/application/components/shared/ToolTag";
import { SkillPillMultiSelect, MemoryPillMultiSelect } from "./SkillMemorySelects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
import { Button } from "@/application/components/ui/button";
import { ScrollArea } from "@/application/components/ui/scroll-area";
import AgentConfigForm from "./AgentConfigForm";
import { AGENT_CONFIG_FORM_ID } from "./formConstants";

interface AgentConfigViewerProps {
  readonly agentName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export default function AgentConfigViewer({
  agentName,
  open,
  onOpenChange,
}: Readonly<AgentConfigViewerProps>) {
  const { data: config, isLoading, error } = useAgentConfig(open ? agentName : null);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const {
    data: promptRegistry,
    isLoading: promptRegistryLoading,
    isError: promptRegistryError,
    refetch: refetchPrompts,
  } = usePrompts();
  const {
    data: modelRegistry,
    isLoading: modelRegistryLoading,
    isError: modelRegistryError,
    refetch: refetchModels,
  } = useModels();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  /**
   * Read-only built-in assistant (spec feat-composable-mcp.md §REQ-046 and
   * §REQ-034): its name is reserved, so the name alone is authoritative even
   * before metadata loads. The definition stays readable while Edit/Delete
   * are unavailable and Export is hidden — dynamic all-tool resolution is
   * not reproduced by an exported YAML snapshot.
   */
  const isBuiltin = isBuiltinAgent(agentName);

  if (!open) return null;

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteAgent.mutate(agentName, {
      onSuccess: () => {
        toast.success(`Agent "${agentName}" deleted`);
        onOpenChange(false);
        setConfirmDelete(false);
      },
      onError: (error) => {
        toast.error(error.message);
        setConfirmDelete(false);
      },
    });
  }

  function handleEditSubmit(data: AgentConfigFormData) {
    const configToUpdate: AgentConfig = {
      ...data,
      system_prompt: data.system_prompt || undefined,
      system_prompt_file: data.system_prompt_file || undefined,
      response_format: data.response_format || undefined,
    };

    const file = agentConfigToYamlFile(configToUpdate, `${agentName}.yaml`);
    updateAgent.mutate(
      { name: agentName, yamlFile: file },
      {
        onSuccess: () => {
          toast.success("Agent updated successfully");
          setMode("view");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  function handleExportYaml() {
    if (!config) return;
    const yamlContent = serializeAgentConfig(config);
    const blob = new Blob([yamlContent], { type: "application/x-yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agentName}.yaml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function handleClose() {
    setMode("view");
    setConfirmDelete(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 sm:p-0">
        <div className="shrink-0 border-b border-border bg-surface px-6 pb-4 pt-6 sm:px-8">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="font-display text-lg">{agentName}</DialogTitle>
            <DialogDescription className="text-sm text-muted">
              {mode === "edit"
                ? "Edit the agent configuration below, then save your changes."
                : isBuiltin
                  ? "View the built-in agent configuration. This definition is managed by Composable and is read-only."
                  : "View the agent configuration. Use Edit to modify or Export to download YAML."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ViewerBody
          config={config}
          isLoading={isLoading}
          error={error}
          mode={mode}
          promptRegistry={promptRegistry}
          promptRegistryLoading={promptRegistryLoading}
          promptRegistryError={promptRegistryError}
          modelRegistry={modelRegistry}
          modelRegistryLoading={modelRegistryLoading}
          modelRegistryError={modelRegistryError}
          onRetryPromptRegistry={() => void refetchPrompts()}
          onRetryModelRegistry={() => void refetchModels()}
          onToggleMode={() => setMode("view")}
          onSubmit={handleEditSubmit}
          isPending={updateAgent.isPending}
        />

        {mode === "view" && !isBuiltin && (
          <ViewerFooter
            configPresent={config != null}
            confirmDelete={confirmDelete}
            isPending={deleteAgent.isPending}
            onExportYaml={handleExportYaml}
            onEdit={() => setMode("edit")}
            onDelete={handleDelete}
          />
        )}
        {mode === "view" && isBuiltin && !config && !isLoading && !error && (
          <p className="shrink-0 border-t border-border bg-surface px-6 py-4 font-mono text-xs text-muted sm:px-8">
            Read-only agent — no mutable configuration is available.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ViewerBodyProps {
  readonly config: AgentConfig | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly mode: "view" | "edit";
  readonly promptRegistry: PromptMetadata[] | undefined;
  readonly promptRegistryLoading: boolean;
  readonly promptRegistryError: boolean;
  readonly modelRegistry: ModelConfiguration[] | undefined;
  readonly modelRegistryLoading: boolean;
  readonly modelRegistryError: boolean;
  readonly onRetryPromptRegistry: () => void;
  readonly onRetryModelRegistry: () => void;
  readonly onToggleMode: () => void;
  readonly onSubmit: (data: AgentConfigFormData) => void;
  readonly isPending: boolean;
}

function ViewerBody({
  config,
  isLoading,
  error,
  mode,
  promptRegistry,
  promptRegistryLoading,
  promptRegistryError,
  modelRegistry,
  modelRegistryLoading,
  modelRegistryError,
  onRetryPromptRegistry,
  onRetryModelRegistry,
  onToggleMode,
  onSubmit,
  isPending,
}: Readonly<ViewerBodyProps>) {
  if (mode === "edit" && config) {
    return (
      <>
        <AgentConfigForm
          mode="edit"
          initialData={config}
          onSubmit={onSubmit}
          onCancel={onToggleMode}
          isPending={isPending}
        />
        <div className="mt-4 flex items-center gap-3 border-t border-border-soft pt-4 lg:hidden">
          <Button type="submit" form={AGENT_CONFIG_FORM_ID} disabled={isPending} className="flex-1">
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </>
    );
  }
  return (
    <ScrollArea className="max-h-[70vh]">
      {isLoading && (
        <p className="py-8 text-center font-mono text-sm text-muted" aria-live="polite">
          Loading configuration…
        </p>
      )}

      {error && (
        <p className="py-8 text-center font-mono text-sm text-danger">
          Failed to load configuration: {error.message}
        </p>
      )}

      {config && (
        <ConfigOverview
          config={config}
          promptRegistry={promptRegistry}
          promptRegistryLoading={promptRegistryLoading}
          promptRegistryError={promptRegistryError}
          modelRegistry={modelRegistry}
          modelRegistryLoading={modelRegistryLoading}
          modelRegistryError={modelRegistryError}
          onRetryPromptRegistry={onRetryPromptRegistry}
          onRetryModelRegistry={onRetryModelRegistry}
        />
      )}
    </ScrollArea>
  );
}

interface ViewerFooterProps {
  readonly configPresent: boolean;
  readonly confirmDelete: boolean;
  readonly isPending: boolean;
  readonly onExportYaml: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

function ViewerFooter({
  configPresent,
  confirmDelete,
  isPending,
  onExportYaml,
  onEdit,
  onDelete,
}: Readonly<ViewerFooterProps>) {
  return (
    <div className="shrink-0 border-t border-border bg-surface px-6 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={onExportYaml} disabled={!configPresent}>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Export YAML</span>
          <span className="sm:hidden">Export</span>
        </Button>
        <Button type="button" variant="default" onClick={onEdit} disabled={!configPresent}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Edit</span>
          <span className="sm:hidden">Edit</span>
        </Button>
        <div className="flex-1" />
        <Button type="button" variant="destructive" onClick={onDelete} disabled={isPending}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {confirmDelete ? "Confirm Delete?" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Read-only configuration overview. Sections are extracted so each keeps a
 * low cognitive complexity (Sonar S3776).
 */
function ConfigOverview({
  config,
  promptRegistry,
  promptRegistryLoading,
  promptRegistryError,
  modelRegistry,
  modelRegistryLoading,
  modelRegistryError,
  onRetryPromptRegistry,
  onRetryModelRegistry,
}: Readonly<{
  config: AgentConfig;
  promptRegistry: PromptMetadata[] | undefined;
  promptRegistryLoading: boolean;
  promptRegistryError: boolean;
  modelRegistry: ModelConfiguration[] | undefined;
  modelRegistryLoading: boolean;
  modelRegistryError: boolean;
  onRetryPromptRegistry: () => void;
  onRetryModelRegistry: () => void;
}>) {
  // Resolve reference display names client-side from the user's own
  // registries (the backend config payload carries ids only). Legacy
  // enrichment fields are kept as an opportunistic display path; the raw
  // UUID is never presented as if it were a name.
  const catalogModel = config.model_ref
    ? modelRegistry?.find((m) => m.id === config.model_ref)
    : undefined;
  const catalogModelDisplay = resolveRefDisplay({
    registryName: catalogModel?.name,
    legacyName: config.catalog_model_name ?? undefined,
    registryLoading: modelRegistryLoading,
    registryFailed: modelRegistryError,
  });
  const catalogModelProviderModel =
    catalogModel?.provider_model ?? config.catalog_model_provider_model ?? undefined;
  const promptDisplay = resolveRefDisplay({
    registryName: config.prompt_ref
      ? promptRegistry?.find((p) => p.id === config.prompt_ref.id)?.name
      : undefined,
    legacyName: config.prompt_name ?? undefined,
    registryLoading: promptRegistryLoading,
    registryFailed: promptRegistryError,
  });

  return (
    <div className="space-y-6">
      <ModelSection
        config={config}
        display={catalogModelDisplay}
        providerModel={catalogModelProviderModel}
        onRetryRegistry={onRetryModelRegistry}
      />
      {config.description && <DescriptionSection description={config.description} />}
      <PromptSection
        config={config}
        displayName={promptDisplay.label}
        registryFailed={promptDisplay.failed}
        showName={Boolean(config.prompt_ref)}
        onRetryRegistry={onRetryPromptRegistry}
      />
      <BackendSection backend={config.backend} />
      <SkillsSection skills={config.skills} />
      <MemoriesSection memory={config.memory} />
      <HitlSection rules={config.hitl.rules} />
      <McpSection servers={config.mcp_servers} />
      <SubagentsSection subagents={config.subagents} />
    </div>
  );
}

/** Inline alert shown when the registry request itself failed (BUG-002). */
function RegistryRetryStrip({ odId, onRetry }: Readonly<{ odId: string; onRetry: () => void }>) {
  return (
    <div
      role="alert"
      data-od-id={odId}
      className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-danger bg-danger/10 p-3"
    >
      <p className="font-mono text-xs text-danger">
        Registry unavailable — reference could not be verified
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function ModelSection({
  config,
  display,
  providerModel,
  onRetryRegistry,
}: Readonly<{
  config: AgentConfig;
  display: RefDisplay;
  providerModel?: string;
  onRetryRegistry: () => void;
}>) {
  if (!config.model_ref) {
    return (
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <SectionLabel>Model</SectionLabel>
          <p className="break-all font-mono text-sm text-fg">{config.model}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <SectionLabel>Catalog Model</SectionLabel>
        <p className="break-all font-mono text-sm text-fg">{display.label}</p>
        {providerModel && <p className="break-all font-mono text-xs text-muted">{providerModel}</p>}
      </div>
      {display.failed && (
        <RegistryRetryStrip odId="agent-model-registry-unavailable" onRetry={onRetryRegistry} />
      )}
    </div>
  );
}

function DescriptionSection({ description }: Readonly<{ description: string }>) {
  return (
    <div>
      <SectionLabel>Description</SectionLabel>
      <p className="break-all font-mono text-sm text-fg-2">{description}</p>
    </div>
  );
}

function PromptSection({
  config,
  displayName,
  registryFailed,
  showName,
  onRetryRegistry,
}: Readonly<{
  config: AgentConfig;
  displayName: string;
  registryFailed: boolean;
  showName: boolean;
  onRetryRegistry: () => void;
}>) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  if (showName) {
    const versionLabel =
      config.prompt_ref?.version != null ? `v${config.prompt_ref.version}` : "Latest";
    return (
      <div>
        <SectionLabel>Registry Prompt</SectionLabel>
        <p className="break-all font-mono text-sm text-fg">{displayName}</p>
        <p className="font-mono text-xs text-muted">{versionLabel}</p>
        {registryFailed && (
          <RegistryRetryStrip odId="agent-prompt-registry-unavailable" onRetry={onRetryRegistry} />
        )}
      </div>
    );
  }

  if (!config.system_prompt) {
    return null;
  }
  return (
    <div>
      <SectionLabel>System Prompt</SectionLabel>
      <div className="max-h-60 overscroll-contain overflow-y-auto border border-border-soft bg-surface-warm p-3 font-mono text-xs leading-relaxed text-fg-2">
        {promptExpanded ? config.system_prompt : `${config.system_prompt.slice(0, 280)}…`}
        {config.system_prompt.length > 280 && (
          <button
            type="button"
            onClick={() => setPromptExpanded((p) => !p)}
            className="ml-2 font-mono text-xs uppercase tracking-[0.1em] text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:shadow-focus"
          >
            {promptExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

function BackendSection({ backend }: Readonly<{ backend: AgentConfig["backend"] }>) {
  return (
    <div>
      <SectionLabel>Backend</SectionLabel>
      <div className="space-y-1 font-mono text-sm text-fg">
        <p>
          checkpoint_backend: <span className="text-accent">{backend.checkpoint_backend}</span>
        </p>
      </div>
    </div>
  );
}

function SkillsSection({ skills }: Readonly<{ skills: string[] }>) {
  if (skills.length === 0) return null;
  return (
    <div>
      <SectionLabel>Skills ({skills.length})</SectionLabel>
      <SkillPillMultiSelect selected={skills} readOnly />
    </div>
  );
}

function MemoriesSection({ memory }: Readonly<{ memory: string[] }>) {
  if (memory.length === 0) return null;
  return (
    <div>
      <SectionLabel>Memories ({memory.length})</SectionLabel>
      <MemoryPillMultiSelect selected={memory} readOnly />
    </div>
  );
}

function HitlSection({ rules }: Readonly<{ rules: AgentConfig["hitl"]["rules"] }>) {
  if (Object.keys(rules).length === 0) return null;
  return (
    <div>
      <SectionLabel>HITL Rules</SectionLabel>
      <div className="space-y-1 border border-border-soft bg-surface-warm p-3">
        {Object.entries(rules).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between font-mono text-xs">
            <span className="break-all text-fg">{key}</span>
            <span className="ml-3 shrink-0 text-muted">{formatHitlValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHitlValue(value: boolean | { before?: boolean; after?: boolean }): string {
  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }
  return JSON.stringify(value);
}

function McpSection({ servers }: Readonly<{ servers: AgentConfig["mcp_servers"] }>) {
  if (servers.length === 0) return null;
  return (
    <div>
      <SectionLabel>MCP Servers ({servers.length})</SectionLabel>
      <div className="space-y-2">
        {servers.map((server) => (
          <div
            key={server.name}
            className="flex items-center justify-between border border-border-soft bg-surface-warm p-3"
          >
            <span className="font-mono text-sm text-fg">{server.name}</span>
            <ToolTag label={server.transport} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SubagentsSection({ subagents }: Readonly<{ subagents: AgentConfig["subagents"] }>) {
  if (subagents.length === 0) return null;
  return (
    <div>
      <SectionLabel>Subagents ({subagents.length})</SectionLabel>
      <div className="space-y-2">
        {subagents.map((sub) => (
          <div key={sub.name} className="border border-border-soft bg-surface-warm p-3">
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-fg">{sub.name}</p>
              {sub.agent_ref && <Badge variant="outline">ref: {sub.agent_ref}</Badge>}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">{sub.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <h4 className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-muted">{children}</h4>
  );
}

interface RefDisplay {
  readonly label: string;
  readonly available: boolean;
  /** True when the registry REQUEST failed — an explicit retryable state (BUG-002). */
  readonly failed: boolean;
}

/**
 * Reference display resolution: the name resolved from the user's registry,
 * the legacy enrichment field if present, a neutral loading label while the
 * registry query is in-flight, an explicit retryable "registry unavailable"
 * label when the request failed, otherwise the "unavailable" label only for
 * a resolved-empty registry — never the raw UUID presented as a name.
 */
function resolveRefDisplay({
  registryName,
  legacyName,
  registryLoading,
  registryFailed,
}: Readonly<{
  registryName?: string;
  legacyName?: string;
  registryLoading: boolean;
  registryFailed: boolean;
}>): RefDisplay {
  const name = registryName ?? legacyName;
  if (name) {
    return { label: name, available: true, failed: false };
  }
  if (registryLoading) {
    return { label: "Loading registry…", available: true, failed: false };
  }
  if (registryFailed) {
    return {
      label: "Registry unavailable — reference could not be verified",
      available: false,
      failed: true,
    };
  }
  return { label: "Not in your registry anymore", available: false, failed: false };
}
