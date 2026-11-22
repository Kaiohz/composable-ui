/**
 * Reusable model configuration (model-catalog-settings-only.md §B). A Model
 * resource carries ONLY its identity: a display name and the provider model
 * identifier to execute. The provider connection (`provider`, `base_url`,
 * `api_key`) is owned exclusively by the user's LLM Settings — never by a
 * Model, and no credential material ever lives here.
 */
export interface ModelConfiguration {
  id: string;
  name: string;
  provider_model: string;
  created_at: string;
  updated_at: string;
}

export interface ModelCreateInput {
  name: string;
  provider_model: string;
}

export interface ModelUpdateInput {
  name?: string;
  provider_model?: string;
}
