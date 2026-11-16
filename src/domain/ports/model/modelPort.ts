import type {
  ModelConfiguration,
  ModelCreateInput,
  ModelUpdateInput,
} from "@/domain/entities/model/modelConfiguration";

/**
 * Port for the per-user, metadata-only model catalog (spec §MDL-003).
 * Credential management is explicitly out of scope — no port method carries
 * or accepts any credential field.
 */
export interface IModelPort {
  listModels(): Promise<ModelConfiguration[]>;
  createModel(input: ModelCreateInput): Promise<ModelConfiguration>;
  getModel(id: string): Promise<ModelConfiguration>;
  updateModel(id: string, patch: ModelUpdateInput): Promise<ModelConfiguration>;
  /** 409 Conflict when any agent references the model. */
  deleteModel(id: string): Promise<void>;
}
