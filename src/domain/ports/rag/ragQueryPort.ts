import type { ClassicalQueryRequest } from "@/domain/entities/rag/queryRequest";
import type { ClassicalQueryResponse } from "@/domain/entities/rag/classicalQueryResponse";

/**
 * Port for the mcp-raganything classical query surface (REQ-006). The
 * `working_dir` request field is RELATIVE to the caller's scope (an empty
 * value composes the scope root server-side); the backend composes
 * `{user_id}/{agent_slug}/{working_dir}/`. `agentSlug` selects the space.
 */
export interface IRagQueryPort {
  queryClassical(
    request: ClassicalQueryRequest,
    agentSlug?: string,
  ): Promise<ClassicalQueryResponse>;
}
