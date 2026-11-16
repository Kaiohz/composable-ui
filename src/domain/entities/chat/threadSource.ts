/**
 * Thread origin — immutable `chat` | `cron` discriminator (spec §SRC-001).
 * Existing rows are backfilled to `chat`; cron threads are always `cron`.
 */
export type ThreadSource = "chat" | "cron";
