import { ragApiClient } from "@/infrastructure/api/ragAxiosInstance";
import type { ISpacePort } from "@/domain/ports/space/spacePort";
import { validateSpacesPayload, type SpaceRecord } from "@/domain/entities/space/spaceRecord";

/**
 * Infrastructure adapter — implements {@link ISpacePort} against the
 * mcp-raganything spaces REST surface (`GET /api/v1/spaces`, REQ-010 —
 * `space_routes.py`, mounted at `/api/v1`), authenticated with the caller's
 * own credential like every other RAG call.
 *
 * The payload is validated against the rag_spaces invariants (REQ-019): a
 * `personal` row is dropped (the Personal entry is synthesized client-side)
 * and every other space survives.
 */
export const spaceApi: ISpacePort = {
  async listSpaces(): Promise<SpaceRecord[]> {
    const response = await ragApiClient.get<SpaceRecord[]>("/api/v1/spaces");
    return validateSpacesPayload(response.data);
  },
};
