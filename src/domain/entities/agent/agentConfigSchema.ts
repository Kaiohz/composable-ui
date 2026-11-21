import { z } from "zod";
import { BackendType } from "./agentConfig";
import { McpTransportType } from "./mcpServerConfig";

export const interruptRuleSchema = z.object({
  before: z.boolean().optional(),
  after: z.boolean().optional(),
});

export const hitlConfigSchema = z.object({
  rules: z.record(z.string(), z.union([z.boolean(), interruptRuleSchema])),
});

export const backendConfigSchema = z
  .object({
    type: z.enum([BackendType.STORE]),
    checkpoint_backend: z.enum(["memory", "postgres"]).default("memory"),
  })
  .strict();

export const mcpServerConfigSchema = z.object({
  name: z.string().min(1, "MCP server name is required"),
  transport: z.enum([McpTransportType.STDIO, McpTransportType.HTTP]),
  command: z.string().nullable().optional(),
  args: z.array(z.string()),
  url: z.string().nullable().optional(),
  headers: z.record(z.string(), z.string()),
  env: z.record(z.string(), z.string()),
  auth_token: z.string().nullable().optional(),
});

export const subAgentConfigSchema = z.object({
  name: z.string().min(1, "Subagent name is required"),
  description: z.string().min(1, "Subagent description is required"),
  agent_ref: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  tools: z.array(z.string()),
  skills: z.array(z.string()),
  mcp_servers: z.array(mcpServerConfigSchema),
  response_format: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Registry prompt reference: opaque id + optional pinned positive version. */
export const promptRefSchema = z.object({
  id: z.string().min(1, "Prompt reference id is required"),
  version: z
    .number()
    .int("Prompt version must be an integer")
    .positive("Prompt version must be greater than zero")
    .optional(),
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A prompt-source/model field is "present" when non-null (empty strings count). */
function isPresent(value: unknown): boolean {
  return value != null;
}

const agentConfigBaseSchema = z.object({
  name: z
    .string()
    .min(1, "Agent name is required")
    .max(100, "Agent name must be 100 characters or less")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Agent name must contain only alphanumeric characters, dots, hyphens, and underscores",
    ),
  // Legacy custom model string: optional now — required via refinement when
  // no `model_ref` is present (spec §AGT-003).
  model: z.string().min(1, "Model is required").optional(),
  description: z.string().nullable().optional(),
  system_prompt: z.string().nullable().optional(),
  system_prompt_file: z.string().nullable().optional(),
  prompt_ref: promptRefSchema.optional(),
  model_ref: z.string().min(1, "Model reference id is required").optional(),
  tools: z.array(z.string()),
  backend: backendConfigSchema,
  hitl: hitlConfigSchema,
  memory: z.array(z.string()),
  skills: z.array(z.string()),
  subagents: z.array(subAgentConfigSchema),
  /**
   * Inline MCP servers. Optional with an empty default since the
   * resource-only contract (spec agent-resource-import REQ-MCP-003): a
   * reference-only document carries `mcp_refs` and MAY omit the legacy list
   * entirely (a legacy document keeps its inline list). The serializers
   * still emit an explicit empty list so every produced document satisfies
   * the mandatory-key backend mirrors as well.
   */
  mcp_servers: z.array(mcpServerConfigSchema).optional().default([]),
  /**
   * Registered-server identities — resource-only MCP selection
   * (spec agent-resource-import REQ-MCP-003). Identities are the REGISTRY
   * SERVER NAMES (not UUIDs): the runner resolves them against the user's
   * MCP Registry.
   */
  mcp_refs: z.array(z.string()).optional(),
  response_format: z.record(z.string(), z.unknown()).nullable().optional(),
  debug: z.boolean(),
});

type AgentConfigBase = z.infer<typeof agentConfigBaseSchema>;

/**
 * Presence-based mutual exclusivity and reference requirements
 * (spec §AGT-002/§AGT-003): an empty inline value must not bypass the rule.
 * `enforceUuid` toggles the UUID format checks — the server stays
 * authoritative for identifier format validation, while the shared YAML
 * schema enforces it strictly. Each rule lives in its own small validator
 * (Sonar S3776); the composed refinement keeps identical messages/paths.
 */
interface PromptSourceValues {
  readonly prompt: string | undefined;
  readonly promptFile: string | undefined;
}

function validatePromptRef(
  config: AgentConfigBase,
  ctx: z.RefinementCtx,
  values: PromptSourceValues,
  enforceUuid: boolean,
): void {
  const promptRef = config.prompt_ref;
  if (!promptRef) return;
  if (enforceUuid && !UUID_PATTERN.test(promptRef.id)) {
    ctx.addIssue({
      code: "custom",
      path: ["prompt_ref"],
      message: "Prompt reference must be a UUID",
    });
  }
  if (values.prompt !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["prompt_ref"],
      message: "prompt_ref is mutually exclusive with system_prompt (even when empty)",
    });
  }
  if (values.promptFile !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["prompt_ref"],
      message: "prompt_ref is mutually exclusive with system_prompt_file (even when empty)",
    });
  }
}

function validatePromptFieldExclusivity(ctx: z.RefinementCtx, values: PromptSourceValues): void {
  if (values.prompt !== undefined && values.promptFile !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["system_prompt_file"],
      message: "system_prompt and system_prompt_file are mutually exclusive",
    });
  }
}

/**
 * YAML-document rule (REQ-LEGACY-001): a legacy document must carry a model
 * in some form — the legacy inline string or the catalog `model_ref`.
 */
function validateLegacyModelPresence(config: AgentConfigBase, ctx: z.RefinementCtx): void {
  const modelRef = config.model_ref;
  if (modelRef) {
    if (!UUID_PATTERN.test(modelRef)) {
      ctx.addIssue({
        code: "custom",
        path: ["model_ref"],
        message: "Model reference must be a UUID",
      });
    }
    return;
  }
  if (!isPresent(config.model)) {
    ctx.addIssue({
      code: "custom",
      path: ["model"],
      message: "Model is required when no catalog model_ref is provided",
    });
  }
}

function refineAgentConfig(
  config: AgentConfigBase,
  ctx: z.RefinementCtx,
  enforceUuid: boolean,
  requireResourceRefs: boolean,
): void {
  const values: PromptSourceValues = {
    prompt: isPresent(config.system_prompt) ? String(config.system_prompt) : undefined,
    promptFile: isPresent(config.system_prompt_file)
      ? String(config.system_prompt_file)
      : undefined,
  };
  validatePromptRef(config, ctx, values, enforceUuid);
  validatePromptFieldExclusivity(ctx, values);
  if (enforceUuid) {
    validateLegacyModelPresence(config, ctx);
  }
  if (requireResourceRefs) {
    validateRequiredResourceRefs(config, ctx);
  }
}

/** Full strict schema used for YAML parsing and payload validation. */
export const agentConfigSchema = agentConfigBaseSchema.strict().superRefine((config, ctx) => {
  refineAgentConfig(config, ctx, true, false);
});

/**
 * Resource-only form requirements (spec agent-resource-import REQ-FORM-005):
 * a manual save must carry a catalog model reference and a registry prompt
 * reference. Inline legacy drafts are cleared by the form before validation,
 * so they can never satisfy this rule (REQ-LEGACY-002). The built-in
 * customization is exempt (REQ-BUILTIN-005): without a selection it keeps
 * its platform defaults.
 */
function validateRequiredResourceRefs(config: AgentConfigBase, ctx: z.RefinementCtx): void {
  if (!config.model_ref) {
    ctx.addIssue({
      code: "custom",
      path: ["model"],
      message: "Model is required when no catalog model_ref is provided",
    });
  }
  if (!config.prompt_ref) {
    ctx.addIssue({
      code: "custom",
      path: ["prompt_ref"],
      message: "Prompt is required when no registry prompt_ref is provided",
    });
  }
}

export interface AgentConfigFormSchemaOptions {
  /**
   * Whether a save must carry registered model/prompt references
   * (REQ-FORM-005). Only the built-in customization passes `false`
   * (REQ-BUILTIN-005).
   */
  readonly requireResourceRefs: boolean;
}

/**
 * Form-level schema factory: identical rules except the UUID format checks,
 * which the server authoritatively enforces (spec §AGT-004.8). Registry
 * fixture ids are opaque strings at the UI boundary. The built-in
 * customization builds the variant that does not force resource selections
 * (REQ-BUILTIN-005).
 */
export function buildAgentConfigFormSchema(options: AgentConfigFormSchemaOptions) {
  return agentConfigBaseSchema.strict().superRefine((config, ctx) => {
    refineAgentConfig(config, ctx, false, options.requireResourceRefs);
  });
}

export type AgentConfigFormInput = z.input<typeof agentConfigSchema>;

/** The form-validated output shape, derived from the form factory itself. */
export type AgentConfigFormData = z.infer<ReturnType<typeof buildAgentConfigFormSchema>>;
