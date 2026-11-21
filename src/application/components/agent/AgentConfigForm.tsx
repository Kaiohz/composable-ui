import { useCallback, memo, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AgentConfig, SubAgentConfig } from "@/domain/entities/agent/agentConfig";
import { BackendType } from "@/domain/entities/agent/agentConfig";
import { BUILTIN_FORCED_HITL_TOOLS } from "@/domain/entities/agent/agentConfigMetadata";
import {
  buildAgentConfigFormSchema,
  type AgentConfigFormData,
  type AgentConfigFormInput,
} from "@/domain/entities/agent/agentConfigSchema";
import {
  buildResourceOnlyValues,
  deriveMcpRefNames,
  deriveSourceState,
  mcpRefsForPayload,
  type SourceState,
  type PromptVersionMode,
} from "@/domain/entities/agent/agentResourceSelection";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/application/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/application/components/ui/select";
import PillMultiSelect, {
  type PillMultiSelectOption,
} from "@/application/components/shared/PillMultiSelect";
import { SkillPillMultiSelect, MemoryPillMultiSelect } from "./SkillMemorySelects";
import SegmentedToggle from "@/application/components/shared/SegmentedToggle";
import SubAgentEditor from "./SubAgentEditor";
import HITLEditor from "./HITLEditor";
import ResponseFormatEditor from "./ResponseFormatEditor";
import { useMcpRegistry } from "@/application/hooks/mcpServer/useMcpRegistry";
import { useAgents } from "@/application/hooks/agent/useAgents";
import { usePrompts } from "@/application/hooks/prompt/usePrompts";
import { usePromptVersions } from "@/application/hooks/prompt/usePromptVersions";
import { useModels } from "@/application/hooks/model/useModels";
import { AGENT_CONFIG_FORM_ID as FORM_ID } from "./formConstants";

type SectionValue =
  | "general"
  | "system-prompt"
  | "backend"
  | "hitl"
  | "memory-skills"
  | "mcp-servers"
  | "subagents"
  | "response-format";

const DEFAULT_OPEN_SECTIONS: SectionValue[] = ["general", "system-prompt"];

const SECTION_META: Record<SectionValue, { label: string }> = {
  general: { label: "General" },
  "system-prompt": { label: "Prompt Source" },
  backend: { label: "Backend" },
  hitl: { label: "HITL" },
  "memory-skills": { label: "Memory & Skills" },
  "mcp-servers": { label: "MCP Servers" },
  subagents: { label: "Subagents" },
  "response-format": { label: "Response Format" },
};

const BACKEND_STORAGE_OPTIONS: { label: string; value: "memory" | "postgres" }[] = [
  { value: "memory", label: "memory" },
  { value: "postgres", label: "postgres" },
];

/** Response-only fields the backend enriches for display; the strict Zod
 *  form schema would reject them as unknown keys (review I3). */
const RESPONSE_ONLY_FIELDS = [
  "prompt_name",
  "catalog_model_name",
  "catalog_model_provider_model",
] as const;

const DEFAULT_FORM_VALUES: AgentConfigFormInput = {
  name: "",
  tools: [],
  backend: {
    type: BackendType.STORE,
    checkpoint_backend: "memory",
  },
  hitl: { rules: {} },
  memory: [],
  skills: [],
  subagents: [],
  mcp_servers: [],
  response_format: undefined,
  debug: false,
};

function getDefaultValues(
  mode: "create" | "edit",
  initialData?: AgentConfig,
): AgentConfigFormInput {
  if (mode === "edit" && initialData) {
    const editableData = { ...initialData };
    // Overlay markers and display shortcuts are response metadata, not form
    // fields: the strict Zod form schema would otherwise reject them as
    // unknown keys and silently refuse the save (review I3).
    delete editableData.is_builtin;
    delete editableData.is_customized;
    for (const field of RESPONSE_ONLY_FIELDS) {
      delete editableData[field];
    }
    return {
      ...DEFAULT_FORM_VALUES,
      ...editableData,
      model_ref: undefined,
      prompt_ref: undefined,
      mcp_refs: undefined,
      mcp_servers: [],
      response_format: initialData.response_format ?? undefined,
    };
  }
  return { ...DEFAULT_FORM_VALUES };
}

interface AgentConfigFormProps {
  mode: "create" | "edit";
  initialData?: AgentConfig;
  onSubmit: (data: AgentConfigFormData) => void;
  onCancel: () => void;
  isPending?: boolean;
  /**
   * Built-in mode: subagents stay unavailable (REQ-BUILTIN-004), the HITL
   * floor is locked and the required model/prompt rule does not apply — the
   * platform defaults remain in charge when nothing is selected
   * (REQ-BUILTIN-005).
   */
  isBuiltin?: boolean;
  /**
   * When true the internal action row is not rendered — the owning dialog
   * (e.g. AgentConfigViewer edit mode) supplies its own single Cancel/Save
   * footer so one submit control is ever visible (review C1).
   */
  hideActions?: boolean;
}

export default function AgentConfigForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
  isBuiltin = false,
  hideActions = false,
}: Readonly<AgentConfigFormProps>) {
  const [sourceState, setSourceState] = useState<SourceState>(() => deriveSourceState(initialData));
  const [mcpRefNames, setMcpRefNames] = useState<string[]>(() => deriveMcpRefNames(initialData));

  // REQ-FORM-005: a manual custom-agent save requires a catalog model and a
  // registry prompt; the built-in customization keeps its platform defaults
  // when nothing is selected (REQ-BUILTIN-005).
  const formSchema = useMemo(
    () => buildAgentConfigFormSchema({ requireResourceRefs: !isBuiltin }),
    [isBuiltin],
  );
  const zodValidate = useMemo(() => zodResolver(formSchema), [formSchema]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<AgentConfigFormInput, unknown, AgentConfigFormData>({
    // The resolver merges the latest registry selections (kept in render
    // state, read from the freshest render scope) into the validated values
    // and clears the legacy inline fields before validation.
    resolver: (values, context, options) => {
      // Registry-list state per validation call; a Set is negligible here.
      const registryNames = new Set((mcpRegistryServers ?? []).map((s) => s.name));
      const mcpRefs = mcpRefsForPayload(mcpRefNames, registryNames, mcpRegistryServers != null);
      return zodValidate(buildResourceOnlyValues(values, sourceState, mcpRefs), context, options);
    },
    defaultValues: getDefaultValues(mode, initialData),
    // Legacy prompt-source drafts must survive conditional unmounting
    // (spec fix-agent-prompt-source-ui REQ-011): keep the react-hook-form
    // draft-preservation contract explicit rather than relying on a silence.
    shouldUnregister: false,
  });

  const subagentsArray = useFieldArray({ control, name: "subagents" });

  const checkpointBackend = useWatch({ control, name: "backend.checkpoint_backend" });
  const currentAgentName = useWatch({ control, name: "name" });
  const { data: existingAgents } = useAgents();

  const {
    data: mcpRegistryServers,
    isLoading: mcpRegistryLoading,
    isError: mcpRegistryError,
    error: mcpRegistryErrorValue,
    refetch: refetchMcpRegistry,
  } = useMcpRegistry();
  const registryMcpNames = useMemo(
    () => new Set((mcpRegistryServers ?? []).map((server) => server.name)),
    [mcpRegistryServers],
  );
  const mcpOptions = useMemo<PillMultiSelectOption[]>(() => {
    const fromRegistry: PillMultiSelectOption[] = (mcpRegistryServers ?? []).map((server) => ({
      value: server.name,
      label: server.name,
      description: server.openapi_url ?? server.url ?? undefined,
    }));
    // Still-selected names outside the registry are surfaced as removable
    // pills — no invisible form data (REQ-LEGACY-002). While the registry
    // list is unavailable the consequence is NOT stated (it cannot be
    // verified yet); once loaded, the pill states that it will be dropped
    // (review I2).
    const registryKnown = mcpRegistryServers != null;
    const unregistered: PillMultiSelectOption[] = mcpRefNames
      .filter((name) => !registryMcpNames.has(name))
      .map((name) => ({
        value: name,
        label: registryKnown ? `${name} (not registered — will be dropped)` : `${name} (custom)`,
      }));
    return [...fromRegistry, ...unregistered];
  }, [mcpRegistryServers, mcpRefNames, registryMcpNames]);
  // Explicit feedback for the drop contract: the user is told BEFORE the
  // save that unregistered selections will not be persisted (review I2).
  const droppedMcpNames = useMemo(
    () =>
      mcpRegistryServers == null ? [] : mcpRefNames.filter((name) => !registryMcpNames.has(name)),
    [mcpRefNames, registryMcpNames, mcpRegistryServers],
  );
  const handleMcpSelectionChange = useCallback((next: string[]) => setMcpRefNames(next), []);
  // TanStack Query's `refetch` is stable per observer; the memoized MCP
  // accordion item requires a stable `onRetry` identity so parent re-renders
  // never defeat `memo` (review J2).
  const handleRetryMcpRegistry = useCallback(() => void refetchMcpRegistry(), [refetchMcpRegistry]);

  const {
    data: promptCatalog,
    isLoading: promptsLoading,
    isError: promptsError,
    error: promptsErrorValue,
    refetch: refetchPrompts,
  } = usePrompts();
  const {
    data: modelCatalog,
    isLoading: modelsLoading,
    isError: modelsError,
    error: modelsErrorValue,
    refetch: refetchModels,
  } = useModels();
  // The immutable history is only consumed by the Pinned selector — the
  // query stays disabled until then (review I8).
  const versionsQuery = usePromptVersions(sourceState.promptId || null, {
    enabled: sourceState.versionMode === "pinned",
  });
  const versionOptions = useMemo(() => {
    return (versionsQuery.data ?? [])
      .slice()
      .sort((a, b) => a.version - b.version)
      .map((v) => ({ value: String(v.version), label: `v${v.version}` }));
  }, [versionsQuery.data]);

  function patchSourceState(patch: Partial<SourceState>) {
    setSourceState((prev) => ({ ...prev, ...patch }));
  }

  function handleFormSubmit(data: AgentConfigFormData) {
    // `data` already carries the mode-selected prompt_ref/model_ref and the
    // cleared mutually exclusive fields (resolver merged them in).
    onSubmit(data);
  }

  function addFromExistingAgent(agentName: string) {
    const existing = (existingAgents ?? []).find((a) => a.name === agentName);
    if (!existing) return;
    subagentsArray.append({
      name: agentName,
      agent_ref: agentName,
      description: existing.description ?? "",
      instructions: undefined,
      model: undefined,
      tools: [],
      skills: [],
      mcp_servers: [],
      response_format: undefined,
    });
  }

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col">
      <Accordion
        type="multiple"
        defaultValue={DEFAULT_OPEN_SECTIONS as never}
        className="space-y-1"
      >
        <AccordionItem value="general">
          <SectionTrigger value="general" />
          <AccordionContent className="space-y-4">
            <FormField id="agent-name" label="Agent Name" error={errors.name?.message}>
              <Input
                id="agent-name"
                {...register("name")}
                disabled={mode === "edit"}
                placeholder="my-agent…"
                autoComplete="off"
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? "agent-name-error" : undefined}
              />
            </FormField>
            <FormField id="description" label="Description">
              <Input
                id="description"
                {...register("description")}
                placeholder="Describe what this agent does…"
                autoComplete="off"
              />
            </FormField>
            <FormField id="model-select" label="Model" error={errors.model?.message}>
              <Select
                value={sourceState.modelRefId}
                onValueChange={(v) => patchSourceState({ modelRefId: v })}
              >
                <SelectTrigger
                  id="model-select"
                  className="w-full"
                  aria-invalid={!!errors.model || undefined}
                  aria-describedby={errors.model ? "model-select-error" : undefined}
                >
                  <SelectValue placeholder="Select a catalog model…" />
                </SelectTrigger>
                <SelectContent>
                  {(modelCatalog ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(modelCatalog ?? []).length === 0 && !modelsError && !modelsLoading && (
                <p className="font-mono text-xs text-muted">
                  No catalog models yet. Create one in the Models page first.
                </p>
              )}
              {modelsLoading && !modelsError && (
                <p className="font-mono text-xs text-muted" aria-live="polite">
                  Loading model catalog…
                </p>
              )}
              {modelsError && (
                <RegistryErrorStrip
                  odId="model-registry-error"
                  error={modelsErrorValue}
                  onRetry={() => void refetchModels()}
                />
              )}
              {sourceState.modelRefId &&
                !modelsLoading &&
                !modelsError &&
                !(modelCatalog ?? []).some((m) => m.id === sourceState.modelRefId) && (
                  <p className="font-mono text-xs text-muted">
                    The stored catalog model is not in your registry anymore.
                  </p>
                )}
            </FormField>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="system-prompt">
          <SectionTrigger value="system-prompt" />
          <AccordionContent className="space-y-4">
            {/* Version semantics belong to the registry selection
            (REQ-FORM-002): Latest is the default; a pinned selection resolves
            exactly one immutable version. */}
            <div className="space-y-2">
              <Label className="block text-xs uppercase tracking-[0.1em]">Version Mode</Label>
              <SegmentedToggle
                value={sourceState.versionMode}
                options={[
                  { value: "latest" as const, label: "Latest" },
                  { value: "pinned" as const, label: "Pinned" },
                ]}
                onChange={(v) => patchSourceState({ versionMode: v as PromptVersionMode })}
                pattern="radio"
                ariaLabel="Version Mode"
              />
              <p className="font-mono text-xs text-muted">
                Latest follows new prompt versions; Pinned resolves one immutable version.
              </p>
            </div>

            {/* Registry-health UI: the registry is the only prompt source. */}
            {promptsError && (
              <RegistryErrorStrip
                odId="prompt-registry-error"
                error={promptsErrorValue}
                onRetry={() => void refetchPrompts()}
              />
            )}
            {promptsLoading && !promptsError && (
              <p className="font-mono text-xs text-muted" aria-live="polite">
                Loading prompt registry…
              </p>
            )}
            <FormField id="prompt-select" label="Prompt" error={errors.prompt_ref?.message}>
              <Select
                value={sourceState.promptId}
                onValueChange={(v) => patchSourceState({ promptId: v })}
              >
                <SelectTrigger
                  id="prompt-select"
                  className="w-full"
                  aria-invalid={!!errors.prompt_ref || undefined}
                  aria-describedby={errors.prompt_ref ? "prompt-select-error" : undefined}
                >
                  <SelectValue placeholder="Select a registry prompt…" />
                </SelectTrigger>
                <SelectContent>
                  {(promptCatalog ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(promptCatalog ?? []).length === 0 && !promptsError && !promptsLoading && (
                <p className="font-mono text-xs text-muted">
                  No registry prompts yet. Create one in the Prompts page first.
                </p>
              )}
            </FormField>

            {sourceState.versionMode === "pinned" && (
              <FormField id="prompt-version-select" label="Version">
                <Select
                  value={sourceState.promptVersion != null ? String(sourceState.promptVersion) : ""}
                  onValueChange={(v) => patchSourceState({ promptVersion: Number(v) })}
                >
                  <SelectTrigger id="prompt-version-select" className="w-full">
                    <SelectValue placeholder="Select an immutable version…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* The immutable history is only fetched in Pinned mode (I8);
                while it is on its way the selector is not confused with an
                empty registry (review J5). */}
                {versionsQuery.isLoading && !promptsError && (
                  <p className="font-mono text-xs text-muted" aria-live="polite">
                    Loading prompt versions…
                  </p>
                )}
              </FormField>
            )}

            {sourceState.promptId &&
              !promptsError &&
              !promptsLoading &&
              !(promptCatalog ?? []).some((p) => p.id === sourceState.promptId) && (
                <p className="font-mono text-xs text-muted">
                  The stored prompt reference is not in your registry anymore.
                </p>
              )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="backend">
          <SectionTrigger value="backend" />
          <AccordionContent className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-[0.1em]">Backend Type</Label>
              <p className="mt-1.5 font-mono text-sm text-accent">store</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.1em]">Checkpoint Backend</Label>
              <Select
                value={checkpointBackend}
                onValueChange={(v) =>
                  setValue("backend.checkpoint_backend", v as "memory" | "postgres")
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKEND_STORAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="hitl">
          <SectionTrigger value="hitl" />
          <AccordionContent className="space-y-4">
            <HITLEditor
              value={useWatch({ control, name: "hitl.rules" })}
              onChange={(rules) => setValue("hitl.rules", rules)}
              lockedKeys={isBuiltin ? BUILTIN_FORCED_HITL_TOOLS : []}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="memory-skills">
          <SectionTrigger value="memory-skills" />
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.1em] text-muted">Memory</Label>
              <MemoryPillMultiSelect
                selected={useWatch({ control, name: "memory" })}
                onChange={(memory) => setValue("memory", memory)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.1em] text-muted">Skills</Label>
              <SkillPillMultiSelect
                selected={useWatch({ control, name: "skills" })}
                onChange={(skills) => setValue("skills", skills)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <McpServersAccordionItem
          options={mcpOptions}
          selected={mcpRefNames}
          onChange={handleMcpSelectionChange}
          emptyMessage="No registered servers. Add servers in the MCP Registry page first."
          isLoading={mcpRegistryLoading}
          isError={mcpRegistryError}
          error={mcpRegistryErrorValue}
          droppedNames={droppedMcpNames}
          onRetry={handleRetryMcpRegistry}
        />

        {!isBuiltin && (
          <AccordionItem value="subagents">
            <SectionTrigger value="subagents" />
            <AccordionContent className="space-y-4">
              {(existingAgents ?? []).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.1em] text-muted">
                    Add from existing agents
                  </Label>
                  <Select value="" onValueChange={(v) => addFromExistingAgent(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an existing agent…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(existingAgents ?? [])
                        .filter(
                          (agent) =>
                            agent.name !== currentAgentName &&
                            !subagentsArray.fields.some(
                              (s) => (s as unknown as SubAgentConfig).agent_ref === agent.name,
                            ),
                        )
                        .map((agent) => (
                          <SelectItem key={agent.name} value={agent.name}>
                            {agent.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {subagentsArray.fields.map((field, index) => (
                <SubAgentEditor
                  key={field.id}
                  index={index}
                  value={field as unknown as SubAgentConfig}
                  onChange={(v) => subagentsArray.update(index, v)}
                  onRemove={() => subagentsArray.remove(index)}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="response-format">
          <SectionTrigger value="response-format" />
          <AccordionContent className="space-y-4">
            <ResponseFormatEditor
              value={useWatch({ control, name: "response_format" })}
              onChange={(v) => setValue("response_format", v)}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="h-2" aria-hidden="true" />

      {errors.root?.message && (
        <p role="alert" className="mt-2 font-mono text-xs text-danger">
          {errors.root.message}
        </p>
      )}

      {!hideActions && (
        <div className="mt-6 hidden items-center justify-end gap-3 border-t border-border-soft pt-4 lg:flex">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {submitLabel(isPending, mode)}
          </Button>
        </div>
      )}
    </form>
  );
}

/** Submit label: pending state first, then the mode verb (S3358). */
function submitLabel(isPending: boolean, mode: "create" | "edit"): string {
  if (isPending) return "Saving…";
  return mode === "create" ? "Create" : "Update";
}

function RegistryErrorStrip({
  odId,
  error,
  onRetry,
}: Readonly<{ odId: string; error: unknown; onRetry: () => void }>) {
  const message = error instanceof Error ? error.message : "Registry unavailable";
  return (
    <div
      role="alert"
      data-od-id={odId}
      className="flex flex-wrap items-center justify-between gap-2 border border-danger bg-danger/10 p-3"
    >
      <p className="font-mono text-xs text-danger">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function SectionTrigger({ value }: Readonly<{ value: SectionValue }>) {
  const meta = SECTION_META[value];
  return (
    <AccordionTrigger className="font-mono text-xs uppercase tracking-[0.1em] text-muted hover:text-accent data-[state=open]:text-accent">
      {meta.label}
    </AccordionTrigger>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

/**
 * Visual wrapper only: the accessibility association lives on the CONTROL —
 * a plain `<div>` is neither focusable nor a widget, so `aria-invalid`/
 * `aria-describedby` have no effect here (review I9). Controls inside the
 * form attach both attributes plus the `${id}-error` description themselves.
 */
function FormField({ id, label, error, children }: Readonly<FormFieldProps>) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-xs uppercase tracking-[0.1em]">
        {label}
      </Label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 font-mono text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// Isolated MCP servers accordion item. MCP servers are managed in their own
// screen (MCP Registry page), so this section only lets users select
// REGISTERED servers via toggle pills — the same pattern as the
// Skills/Memories sections (REQ-FORM-003). Selecting a pill records the
// server's identity; the submitted payload carries `mcp_refs` names only —
// connection parameters and secrets stay in the registry (REQ-MCP-003).
// Free-form server definitions (URL/command/headers/env/token) are not
// enterable anywhere in the form; a genuinely empty, successfully loaded
// registry shows guidance instead of an inline fallback (REQ-FORM-004) while
// loading and failed loads show the dedicated state (review I1).
//
// Available to the built-in customization as well (REQ-BUILTIN-001).
//
// The AccordionItem is memoized so parent form re-renders (from useWatch on
// unrelated fields) do not recompute the registry options.
const McpServersAccordionItem = memo(function McpServersAccordionItem({
  options,
  selected,
  onChange,
  emptyMessage,
  isLoading,
  isError,
  error,
  droppedNames,
  onRetry,
}: Readonly<{
  options: PillMultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyMessage: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  droppedNames: string[];
  onRetry: () => void;
}>) {
  // The drop contract, worded like the pill label it refers to (review I2 /
  // minor #4): unregistered selections are REMOVED from this agent on save.
  const pluralSuffix = droppedNames.length > 1 ? "s are" : " is";
  const dropNotice =
    droppedNames.length === 0
      ? null
      : `${droppedNames.length} selected MCP server${pluralSuffix} no longer registered and will be removed from this agent on save.`;
  // The pills stay reachable in EVERY state: `mcpRefsForPayload` keeps the
  // selection verbatim while the registry is unavailable, so the user must be
  // able to see and change it; they are only hidden when they would be an
  // empty group beside a registry-health message (review J3). The
  // "no servers" guidance must still describe a genuinely empty, loaded
  // registry only (I1).
  const registryKnown = !isLoading && !isError;
  const showPills = registryKnown || selected.length > 0;
  return (
    <AccordionItem value="mcp-servers">
      <SectionTrigger value="mcp-servers" />
      <AccordionContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.1em] text-muted">From registry</Label>
          {isError && (
            <RegistryErrorStrip odId="mcp-registry-error" error={error} onRetry={onRetry} />
          )}
          {!isError && isLoading && (
            <p className="font-mono text-xs text-muted" aria-live="polite">
              Loading MCP registry…
            </p>
          )}
          {showPills && (
            <>
              <PillMultiSelect
                options={options}
                selected={selected}
                onChange={onChange}
                emptyMessage={emptyMessage}
                ariaLabel="Registered MCP servers"
              />
              {dropNotice && (
                <p role="status" aria-live="polite" className="font-mono text-xs text-warn">
                  {dropNotice}
                </p>
              )}
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
});
