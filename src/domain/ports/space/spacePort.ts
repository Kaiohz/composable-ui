import type { SpaceRecord } from "@/domain/entities/space/spaceRecord";

/**
 * Port exposing the caller's RAG spaces (REQ-010): a read-only view used by
 * the shared space selector.
 */
export interface ISpacePort {
  listSpaces(): Promise<SpaceRecord[]>;
}
