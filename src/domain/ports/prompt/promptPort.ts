import type {
  PromptMetadata,
  PromptMetadataUpdateInput,
  PromptVersion,
  PromptVersionCreateInput,
  PromptCreateInput,
} from "@/domain/entities/prompt/prompt";

/** Port for the per-user prompt registry (spec §PR-004). */
export interface IPromptPort {
  listPrompts(): Promise<PromptMetadata[]>;
  createPrompt(input: PromptCreateInput): Promise<PromptMetadata>;
  getPrompt(id: string): Promise<PromptMetadata>;
  /** Metadata-only edit; content is never accepted here. */
  updatePrompt(id: string, patch: PromptMetadataUpdateInput): Promise<PromptMetadata>;
  /** 409 Conflict when any agent references the prompt. */
  deletePrompt(id: string): Promise<void>;
  /** Immutable version history, ordered numerically. */
  listVersions(promptId: string): Promise<PromptVersion[]>;
  createVersion(promptId: string, input: PromptVersionCreateInput): Promise<PromptVersion>;
  getVersion(promptId: string, version: number): Promise<PromptVersion>;
}
