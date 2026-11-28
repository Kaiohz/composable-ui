import { create } from "zustand";
import type { TraceEvent, StructuredResponseResult } from "@/domain/entities/chat/traceEvent";
import {
  TraceEventType,
  getStructuredResponseFromAIEvent,
} from "@/domain/entities/chat/traceEvent";
import type { ChatAttachmentDisplay } from "@/domain/entities/chat/attachment";

/**
 * Composer-side pending attachment (REQ-067/068): the picked browser ``File``
 * plus display metadata. ``file`` is a runtime object — it lives only while
 * the draft exists (send / restore-from-error / remove).
 */
export interface ComposerAttachment {
  id: string;
  file: File;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: "image" | "document";
  previewUrl: string | null;
}

/** Draft saved when a submit starts, restored verbatim on stream error (REQ-071). */
export interface ComposerBackup {
  text: string;
  attachments: ComposerAttachment[];
}

interface SubagentState {
  content: string;
  thinking: string;
  toolCalls: TraceEvent[];
  toolResults: TraceEvent[];
}

interface StreamingTurn {
  turnId: string;
  events: TraceEvent[];
  parentContent: string;
  parentThinking: string;
  subagents: Record<string, SubagentState>;
  currentSource: string | null;
  structured_response: StructuredResponseResult | null;
}

interface ChatState {
  activeThreadId: string | null;
  streamingTurn: StreamingTurn | null;
  isStreaming: boolean;
  /**
   * True from the turn-final AI event until the next stream starts: the
   * streamed bubble is about to hand off to the HISTORY-rendered message
   * (refetch resolves → same-turn remount). While this flag holds, the
   * message list suppresses the enter animation on that take-over message —
   * the animated fade-in replay is what read as an end-of-stream flicker.
   */
  handoffPending: boolean;
  pendingUserMessage: string | null;
  /** Attachment metadata of the pending user message (REQ-069). */
  pendingUserAttachments: ChatAttachmentDisplay[] | null;
  /** Draft kept while a turn runs; restored into the composer on error (REQ-071). */
  composerBackup: ComposerBackup | null;
  /** Backup popped on error; consumed once by the composer (REQ-071). */
  composerRestoredDraft: ComposerBackup | null;
  error: string | null;
  setActiveThread: (id: string | null) => void;
  initStreamingTurn: (turnId: string) => void;
  appendTraceEvent: (event: TraceEvent) => void;
  clearStream: () => void;
  setStreaming: (streaming: boolean) => void;
  setPendingUserMessage: (msg: string | null, attachments?: ChatAttachmentDisplay[] | null) => void;
  backupComposer: (backup: ComposerBackup | null) => void;
  restoreComposerBackup: () => void;
  consumeComposerRestoredDraft: () => void;
  setError: (msg: string | null) => void;
}

function emptyStreamingTurn(turnId: string): StreamingTurn {
  return {
    turnId,
    events: [],
    parentContent: "",
    parentThinking: "",
    subagents: {},
    currentSource: null,
    structured_response: null,
  };
}

function emptySubagentState(): SubagentState {
  return { content: "", thinking: "", toolCalls: [], toolResults: [] };
}

function applyParentEvent(turn: StreamingTurn, ev: TraceEvent): void {
  if (ev.type === TraceEventType.THINKING && ev.content) {
    turn.parentThinking += ev.content;
  } else if (ev.type === TraceEventType.CONTENT && ev.content) {
    turn.parentContent += ev.content;
  }
}

function applySubagentEvent(sub: SubagentState, ev: TraceEvent): void {
  if (ev.type === TraceEventType.THINKING && ev.content) {
    sub.thinking += ev.content;
  } else if (ev.type === TraceEventType.CONTENT && ev.content) {
    sub.content += ev.content;
  } else if (ev.type === TraceEventType.TOOL_CALL) {
    sub.toolCalls = [...sub.toolCalls, ev];
  } else if (ev.type === TraceEventType.TOOL_RESULT) {
    sub.toolResults = [...sub.toolResults, ev];
  }
}

export const useChatStore = create<ChatState>((set) => ({
  activeThreadId: null,
  streamingTurn: null,
  isStreaming: false,
  handoffPending: false,
  pendingUserMessage: null,
  pendingUserAttachments: null,
  composerBackup: null,
  composerRestoredDraft: null,
  error: null,
  setActiveThread: (id) => set({ activeThreadId: id }),
  initStreamingTurn: (turnId) => set({ streamingTurn: emptyStreamingTurn(turnId) }),
  appendTraceEvent: (ev) =>
    set((state) => {
      if (!state.streamingTurn) return state;
      const previous = state.streamingTurn;
      const turn: StreamingTurn = {
        ...previous,
        events: [...previous.events, ev],
        currentSource: ev.source,
      };

      if (ev.source === null) {
        applyParentEvent(turn, ev);
      } else {
        const sub = { ...(previous.subagents[ev.source] ?? emptySubagentState()) };
        applySubagentEvent(sub, ev);
        turn.subagents = { ...previous.subagents, [ev.source]: sub };
      }

      const isAiMessage = ev.type === TraceEventType.AI_MESSAGE;
      if (isAiMessage) {
        turn.structured_response = getStructuredResponseFromAIEvent(ev);
      }
      return {
        streamingTurn: turn,
        isStreaming: !isAiMessage,
        handoffPending: isAiMessage ? true : state.handoffPending,
      };
    }),
  clearStream: () =>
    set({
      streamingTurn: null,
      isStreaming: false,
      handoffPending: false,
      pendingUserMessage: null,
      pendingUserAttachments: null,
      composerBackup: null,
      composerRestoredDraft: null,
      error: null,
    }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setPendingUserMessage: (msg, attachments) =>
    set({ pendingUserMessage: msg, pendingUserAttachments: attachments ?? null }),
  backupComposer: (backup) => set({ composerBackup: backup }),
  restoreComposerBackup: () =>
    set((state) =>
      state.composerBackup
        ? { composerRestoredDraft: state.composerBackup, composerBackup: null }
        : state,
    ),
  consumeComposerRestoredDraft: () => set({ composerRestoredDraft: null }),
  setError: (msg) => set({ error: msg }),
}));
