/**
 * Resolve persisted image attachments to displayable data URLs — spec
 * ``chat-pdf-attachments`` (REQ-027, REQ-070, AC-002).
 *
 * Images live in the user LangGraph Store under
 * ``/chat_attachments/<thread_id>/<attachment_id>/<filename>`` and are
 * fetched through the existing store port. The result is an inline
 * ``data:`` URL — no blob object URL is ever created for stored images, so
 * no URL can leak across unmounts (EDG-014). Documents are NEVER fetched:
 * their temporary RustFS copy is gone after the turn (REQ-075).
 *
 * ``storeApi.getFile`` takes no abort signal, so in-flight requests cannot
 * be cancelled — the old AbortController was decorative (review I7). It is
 * replaced by a session-scoped promise cache keyed by store path: store
 * images are immutable once written (REQ-025), so caching both de-duplicates
 * concurrent/effect-rerun fetches (StrictMode double invocation) and avoids
 * re-downloading the same bytes when the same attachment is displayed more
 * than once (EDG-013).
 */
import { useEffect, useState } from "react";
import { storeApi } from "@/infrastructure/api/store/storeApi";
import {
  chatAttachmentStorePath,
  type ChatAttachmentDisplay,
} from "@/domain/entities/chat/attachment";

/** An attachment is resolvable from the store only when it is a stored image. */
export function isStoreResolvableImage(attachment: ChatAttachmentDisplay): boolean {
  return attachment.kind === "image" && attachment.source === "langgraph_store";
}

/** Resolves to the stored base64 content, or null when missing/unavailable. */
type AttachmentImageLoader = Promise<string | null>;

const attachmentImageCache = new Map<string, AttachmentImageLoader>();

function loadStoredAttachmentContent(path: string): AttachmentImageLoader {
  // S6544: a Promise must never be evaluated in a boolean conditional — gate
  // on membership, then return the non-null loader already in the map.
  if (!attachmentImageCache.has(path)) {
    spawnAttachmentImageLoader(path);
  }
  const cached = attachmentImageCache.get(path) as AttachmentImageLoader;
  return cached;
}

/** Creates and registers the loader for ``path`` (single call site, see above). */
function spawnAttachmentImageLoader(path: string): void {
  // ``await``-based so a stubbed port returning a bare value (unit mocks) or
  // a rejecting fetch both degrade to ``null`` instead of leaking rejections.
  const loader: AttachmentImageLoader = (async () => {
    try {
      const file = await storeApi.getFile(path);
      return file?.content ?? null;
    } catch {
      // Store unavailable or file deleted (e.g. thread cascade): keep the
      // attachment unresolved rather than crashing the timeline.
      return null;
    }
  })();
  attachmentImageCache.set(path, loader);
}

export function useStoredAttachmentImages(
  threadId: string | null | undefined,
  attachments: ChatAttachmentDisplay[] | null | undefined,
): Record<string, string> {
  const [resolved, setResolved] = useState<Record<string, string> | null>(null);
  // Primitive key so the effect does not re-fire on identity churn
  // (rerender-dependencies rule).
  const attachmentsKey = attachments?.map((att) => att.id).join("|") ?? "";
  const list = attachmentsKey ? (attachments ?? []) : [];
  const hasResolvableAttachments = Boolean(threadId) && list.length > 0;

  // Derived during render: with no resolvable attachments there is nothing to
  // display — replaces the synchronous `setUrls({})` branch inside the effect
  // (react-hooks/set-state-in-effect). Stale entries from a previous list are
  // harmless: consumers look the record up per attachment id.
  const urls = hasResolvableAttachments && resolved ? resolved : {};

  useEffect(() => {
    if (!threadId || !hasResolvableAttachments) return;

    let cancelled = false;

    void (async () => {
      const resolvedEntries = await Promise.all(
        list.filter(isStoreResolvableImage).map(async (att) => {
          const content = await loadStoredAttachmentContent(chatAttachmentStorePath(threadId, att));
          if (!content) return null;
          return [att.id, `data:${att.content_type};base64,${content}`] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const entry of resolvedEntries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setResolved(next);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, attachmentsKey, hasResolvableAttachments]);

  return urls;
}
