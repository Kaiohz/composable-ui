/**
 * Reusable model configuration (spec §MDL-001). Metadata only: the catalog
 * never contains API keys or any other credential material.
 */
export interface ModelConfiguration {
  id: string;
  name: string;
  provider: string;
  provider_model: string;
  base_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelCreateInput {
  name: string;
  provider: string;
  provider_model: string;
  base_url?: string | null;
}

export interface ModelUpdateInput {
  name?: string;
  provider?: string;
  provider_model?: string;
  base_url?: string | null;
}
