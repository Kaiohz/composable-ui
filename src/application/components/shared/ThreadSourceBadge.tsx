import { cn } from "@/application/lib/utils";
import type { ThreadSource } from "@/domain/entities/chat/threadSource";

interface ThreadSourceBadgeProps {
  readonly source: ThreadSource | null | undefined;
  readonly className?: string;
}

/**
 * Read-only CHAT/CRON thread-origin pill (spec §SRC-003).
 *
 * It reuses the read-only "active pill" presentation of the skills pills
 * (`PillMultiSelect` mono/uppercase/tracked + accent border) without adding
 * any new visual variant. It is intentionally NONINTERACTIVE: a semantic
 * text element, not a button, exposed as "Thread source: <origin>".
 */
export function ThreadSourceBadge({ source, className }: Readonly<ThreadSourceBadgeProps>) {
  if (!source) return null;
  return (
    <span
      data-od-id="thread-source-badge"
      aria-label={`Thread source: ${source}`}
      className={cn(
        "inline-block shrink-0 border px-3 py-1 font-mono text-xs uppercase tracking-[0.1em] border-accent bg-accent/10 text-accent",
        className,
      )}
    >
      {source.toUpperCase()}
    </span>
  );
}

export default ThreadSourceBadge;
