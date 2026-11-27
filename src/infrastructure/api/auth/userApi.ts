import type { UserProfile } from "@/domain/entities/auth/currentUser";
import type { ICurrentUserPort } from "@/domain/ports/auth/currentUserPort";
import { apiClient } from "@/infrastructure/api/axiosInstance";

/**
 * Infrastructure adapter — implements ICurrentUserPort against the
 * composable-agents backend (`/api/v1/users/me`). The backend serialises the
 * principal id as `user_id` (snake_case); the mapping happens HERE so every
 * consumer receives the normalized entity.
 */
export const userApi: ICurrentUserPort = {
  async me(): Promise<UserProfile> {
    const response = await apiClient.get<{
      user_id: string;
      email?: string | null;
      name?: string | null;
      username?: string | null;
    }>("/api/v1/users/me");
    const { user_id, email, name, username } = response.data;
    return { user_id, email, name, username };
  },
};
