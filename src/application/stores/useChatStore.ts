import { create } from "zustand";
import type { TraceEvent, StructuredResponseResult } from "@/domain/entities/chat/traceEvent";
import {
  TraceEventType,
  getStructuredResponseFromAIEvent,
} from "@/domain/entities/chat/traceEvent";

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
  pendingUserMessage: string | null;
  error: string | null;
  setActiveThread: (id: string | null) => void;
  initStreamingTurn: (turnId: string) => void;
  appendTraceEvent: (event: TraceEvent) => void;
  clearStream: () => void;
  setStreaming: (streaming: boolean) => void;
  setPendingUserMessage: (msg: string | null) => void;
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
  pendingUserMessage: null,
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
      };
    }),
  clearStream: () =>
    set({
      streamingTurn: null,
      isStreaming: false,
      pendingUserMessage: null,
      error: null,
    }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setPendingUserMessage: (msg) => set({ pendingUserMessage: msg }),
  setError: (msg) => set({ error: msg }),
}));
