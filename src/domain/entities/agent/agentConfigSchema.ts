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
  mcp_servers: z.array(mcpServerConfigSchema),
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

function validateModelRef(
  config: AgentConfigBase,
  ctx: z.RefinementCtx,
  enforceUuid: boolean,
): void {
  const modelRef = config.model_ref;
  if (modelRef) {
    if (enforceUuid && !UUID_PATTERN.test(modelRef)) {
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
): void {
  const values: PromptSourceValues = {
    prompt: isPresent(config.system_prompt) ? String(config.system_prompt) : undefined,
    promptFile: isPresent(config.system_prompt_file)
      ? String(config.system_prompt_file)
      : undefined,
  };
  validatePromptRef(config, ctx, values, enforceUuid);
  validatePromptFieldExclusivity(ctx, values);
  validateModelRef(config, ctx, enforceUuid);
}

/** Full strict schema used for YAML parsing and payload validation. */
export const agentConfigSchema = agentConfigBaseSchema.strict().superRefine((config, ctx) => {
  refineAgentConfig(config, ctx, true);
});

/**
 * Form-level schema: identical rules except the UUID format checks, which
 * the server authoritatively enforces (spec §AGT-004.8). Registry fixture
 * ids are opaque strings at the UI boundary.
 */
export const agentConfigFormSchema = agentConfigBaseSchema.strict().superRefine((config, ctx) => {
  refineAgentConfig(config, ctx, false);
});

export type AgentConfigFormData = z.infer<typeof agentConfigSchema>;
export type AgentConfigFormInput = z.input<typeof agentConfigSchema>;
