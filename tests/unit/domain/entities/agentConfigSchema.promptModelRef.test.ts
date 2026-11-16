/**
 * Spec: prompts-models-crons-traces.md §AGT-001..AGT-003 (YAML contracts)
 * The strict agent schema must be extended with:
 *  - `prompt_ref`: { id: UUID, version?: positive integer } — optional,
 *    mutually exclusive with system_prompt AND system_prompt_file;
 *  - `model_ref`: UUID — optional; presence-based precedence over `model`,
 *    so `model` becomes optional when model_ref is set;
 *  - exclusivity checks use PRESENCE/non-null values (empty strings do not
 *    bypass the rule).
 *
 * Step-1 (Red): the current schema rejects prompt_ref/model_ref payloads and
 * enforces no prompt-source exclusivity at all.
 */
import { describe, it, expect } from "vitest";
import { agentConfigSchema } from "@/domain/entities/agent/agentConfigSchema";
import { createAgentConfig } from "../../../fixtures/external";

const PROMPT_ID = "7e6a56fd-83e7-46a1-a2f2-f5c5f8d9a52e";
const MODEL_ID = "1a5bca0d-0f14-4ed6-98db-b07c39e0d4a2";

describe("agentConfigSchema — prompt_ref and model_ref", () => {
  it("accepts an agent using prompt_ref latest (version omitted) and model_ref", () => {
    const parsed = agentConfigSchema.parse(
      createAgentConfig({
        system_prompt: undefined,
        model: "ignored-legacy",
        prompt_ref: { id: PROMPT_ID },
        model_ref: MODEL_ID,
      }),
    );

    expect(parsed.prompt_ref).toEqual({ id: PROMPT_ID });
    expect(parsed.model_ref).toBe(MODEL_ID);
  });

  it("accepts a pinned positive integer prompt version", () => {
    const parsed = agentConfigSchema.parse(
      createAgentConfig({
        system_prompt: undefined,
        prompt_ref: { id: PROMPT_ID, version: 3 },
      }),
    );

    expect(parsed.prompt_ref).toEqual({ id: PROMPT_ID, version: 3 });
  });

  it("rejects a zero/negative prompt version", () => {
    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({ system_prompt: undefined, prompt_ref: { id: PROMPT_ID, version: 0 } }),
      ),
    ).toThrow();
    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({ system_prompt: undefined, prompt_ref: { id: PROMPT_ID, version: -1 } }),
      ),
    ).toThrow();
  });

  it("rejects a non-UUID prompt/model reference id", () => {
    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({
          system_prompt: undefined,
          prompt_ref: { id: "not-a-uuid" },
        }),
      ),
    ).toThrow();

    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({
          system_prompt: undefined,
          model_ref: "definitely-not-a-uuid",
        }),
      ),
    ).toThrow();
  });

  it("rejects prompt_ref together with system_prompt (mutual exclusivity)", () => {
    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({
          system_prompt: "You are inline.",
          prompt_ref: { id: PROMPT_ID },
        }),
      ),
    ).toThrow();
  });

  it("rejects prompt_ref together with system_prompt_file (mutual exclusivity)", () => {
    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({
          system_prompt_file: "/prompts/system.txt",
          prompt_ref: { id: PROMPT_ID },
        }),
      ),
    ).toThrow();
  });

  it("presence-based exclusivity: an empty-string system_prompt cannot bypass the rule", () => {
    expect(() =>
      // Emptiness must not defeat the check — presence/non-null governs.
      agentConfigSchema.parse(
        createAgentConfig({
          system_prompt: "",
          prompt_ref: { id: PROMPT_ID },
        } as never),
      ),
    ).toThrow();
  });

  it("rejects system_prompt together with system_prompt_file", () => {
    expect(() =>
      agentConfigSchema.parse(
        createAgentConfig({
          system_prompt: "You are inline.",
          system_prompt_file: "/prompts/system.txt",
        }),
      ),
    ).toThrow();
  });

  it("model_ref is allowed without a legacy `model` string (make model optional)", () => {
    expect(() =>
      agentConfigSchema.parse({
        ...createAgentConfig(),
        model: undefined,
        system_prompt: undefined,
        model_ref: MODEL_ID,
      } as never),
    ).not.toThrow();
  });

  it("keeps legacy agents valid with inline system_prompt and custom model", () => {
    const parsed = agentConfigSchema.parse(
      createAgentConfig({
        model: "openai:anthropic/claude-haiku-4.5:nitro",
        system_prompt: "You are inline.",
      }),
    );

    expect(parsed.model).toBe("openai:anthropic/claude-haiku-4.5:nitro");
    expect(parsed.prompt_ref).toBeUndefined();
    expect(parsed.model_ref).toBeUndefined();
  });
});
