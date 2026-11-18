import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/infrastructure/api/chat/chatApi";
import { useChatStore } from "@/application/stores/useChatStore";
import type { ChatRequest } from "@/domain/entities/chat/chatRequest";
import type { ChatAttachmentDisplay } from "@/domain/entities/chat/attachment";

function generateTurnId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for runtimes without crypto.randomUUID: Web Crypto randomness.
  // The turn id is not security-sensitive, but using the platform CSPRNG
  // avoids Math.random entirely (Sonar S2245) with stronger collision
  // resistance in every runtime that has Web Crypto (all supported ones).
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `turn-${Date.now()}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function useStreamChat(threadId: string | null) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    (request: ChatRequest, pendingAttachments?: ChatAttachmentDisplay[] | null) => {
      if (!threadId) return;

      const { clearStream, setStreaming, setPendingUserMessage, initStreamingTurn } =
        useChatStore.getState();

      clearStream();
      const turnId = generateTurnId();
      initStreamingTurn(turnId);
      setStreaming(true);
      // Empty text is allowed when attachments carry the turn (EDG-001/002):
      // the pending bubble then relies on ``""`` to stay visible with its
      // attachments until the history reloads.
      setPendingUserMessage(request.message ?? "", pendingAttachments ?? null);

      abortRef.current = chatApi.streamMessage(
        threadId,
        request,
        (event) => {
          useChatStore.getState().appendTraceEvent(event);
        },
        async () => {
          try {
            await queryClient.invalidateQueries({
              queryKey: ["history", threadId],
            });
          } finally {
            const { setPendingUserMessage, setStreaming, backupComposer } = useChatStore.getState();
            // Turn completed successfully: the composer draft stays cleared
            // and the pre-submit backup is dropped (REQ-071 only restores on
            // errors), and the finished controller is released so a later
            // ``cancel()`` cannot abort a completed stream.
            setPendingUserMessage(null);
            setStreaming(false);
            backupComposer(null);
            abortRef.current = null;
          }
        },
        (error) => {
          console.error("Stream error:", error);
          const store = useChatStore.getState();
          store.setStreaming(false);
          store.setError(error.message || "An error occurred while streaming.");
          // I6: the optimistic pending bubble showed the same content the
          // restored composer is about to show — drop it so the failure is
          // presented once.
          store.setPendingUserMessage(null, null);
          // REQ-071: a backend error must not lose the current draft — the
          // text and attachments taken by the failed submit are handed back
          // to the composer for retry.
          store.restoreComposerBackup();
          abortRef.current = null;
        },
      );
    },
    [threadId, queryClient],
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      useChatStore.getState().clearStream();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return { stream, cancel };
}
