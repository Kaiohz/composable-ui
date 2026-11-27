import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessagesSquare } from "lucide-react";
import { useThreadHistory } from "@/application/hooks/chat/useThreadHistory";
import { useChatStore } from "@/application/stores/useChatStore";
import { MessageRole, type Message } from "@/domain/entities/chat/message";
import type { TraceEvent, Turn } from "@/domain/entities/chat/traceEvent";
import { TraceEventType } from "@/domain/entities/chat/traceEvent";
import { isLlmNotConfiguredError } from "@/domain/entities/settings/llmSettingsError";
import { Link } from "react-router-dom";
import ThreadSourceBadge from "@/application/components/shared/ThreadSourceBadge";
import ChatMessage from "@/application/components/chat/ChatMessage";
import ThinkingBlock from "@/application/components/chat/ThinkingBlock";
import ToolCallBadge from "@/application/components/chat/ToolCallBadge";
import ToolResultBlock from "@/application/components/chat/ToolResultBlock";
import SubagentPanel from "@/application/components/chat/SubagentPanel";
import StructuredResponseLive from "@/application/components/chat/StructuredResponseLive";
import { MARKDOWN_PROSE_CLASSES } from "@/application/components/chat/markdownStyles";

interface MessageListProps {
  threadId: string;
  agentName: string;
  agentHasResponseFormat?: boolean;
  /**
   * Read-only presentation (e.g. the trace-detail surface): the empty state
   * must not suggest an interactive composer (I2).
   */
  readOnly?: boolean;
  /** Text shown when the thread has no turns. Defaults are derived from `readOnly`. */
  emptyMessage?: string;
}

interface SubagentRuntime {
  name: string;
  content: string;
  thinking: string;
  toolCalls: TraceEvent[];
  toolResults: TraceEvent[];
}

function buildStreamingSubagents(events: TraceEvent[]): SubagentRuntime[] {
  const bySource = new Map<string, SubagentRuntime>();
  const order: string[] = [];
  for (const ev of events) {
    if (ev.source === null) continue;
    let entry = bySource.get(ev.source);
    if (!entry) {
      entry = { name: ev.source, content: "", thinking: "", toolCalls: [], toolResults: [] };
      bySource.set(ev.source, entry);
      order.push(ev.source);
    }
    if (ev.type === TraceEventType.THINKING && ev.content) {
      entry.thinking += ev.content;
    } else if (ev.type === TraceEventType.CONTENT && ev.content) {
      entry.content += ev.content;
    } else if (ev.type === TraceEventType.TOOL_CALL) {
      entry.toolCalls.push(ev);
    } else if (ev.type === TraceEventType.TOOL_RESULT) {
      entry.toolResults.push(ev);
    }
  }
  return order.map((name) => bySource.get(name) as SubagentRuntime);
}

function streamingParentTools(events: TraceEvent[]): {
  toolCalls: TraceEvent[];
  toolResults: TraceEvent[];
} {
  const toolCalls: TraceEvent[] = [];
  const toolResults: TraceEvent[] = [];
  for (const ev of events) {
    if (ev.source !== null) continue;
    if (ev.type === TraceEventType.TOOL_CALL) toolCalls.push(ev);
    else if (ev.type === TraceEventType.TOOL_RESULT) toolResults.push(ev);
  }
  return { toolCalls, toolResults };
}

function messagesFromTurns(turns: Turn[]): Array<{ message: Message; events: TraceEvent[] }> {
  const out: Array<{ message: Message; events: TraceEvent[] }> = [];
  for (const turn of turns) {
    if (turn.human_message) {
      out.push({ message: turn.human_message, events: [] });
    }
    if (turn.ai_message) {
      out.push({ message: turn.ai_message, events: turn.events });
    }
  }
  return out;
}

/**
 * Chat error surface (module-level, hoisted — no component redefinition per
 * render). Renders the raw error verbatim; when the failure is the
 * onboarding LLM-not-configured error (spec feat-composable-mcp.md
 * §REQ-041/§REQ-052), it additionally offers an actionable navigation to
 * `/settings` without exposing any credential material.
 */
function ChatErrorPanel({ agentName, error }: Readonly<{ agentName: string; error: string }>) {
  const missingLlm = isLlmNotConfiguredError(error);
  return (
    <div className="animate-chat-msg-enter flex gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center border border-danger bg-danger/10 font-display text-xs uppercase text-danger"
        aria-hidden="true"
      >
        !
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-fg">{agentName}</span>
        </div>
        <div className="border border-danger bg-bg p-3 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-danger">
            Something went wrong
          </p>
          <p className="mt-1 font-mono text-xs text-danger/80">{error}</p>
          {missingLlm && (
            <Link
              to="/settings"
              data-od-id="chat-error-llm-settings"
              className="mt-2 inline-flex font-mono text-xs uppercase tracking-[0.1em] text-accent underline transition-colors duration-fast ease-standard hover:text-accent-hover focus-visible:outline-none focus-visible:shadow-focus"
            >
              Configure LLM Settings
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({
  threadId,
  agentName,
  agentHasResponseFormat = false,
  readOnly = false,
  emptyMessage,
}: Readonly<MessageListProps>) {
  // The empty state adapts to the surface: the chat composer invites a
  // first message, while a read-only trace timeline reports that no events
  // were recorded (I2).
  const resolvedEmptyMessage =
    emptyMessage ??
    (readOnly ? "This thread has no recorded events." : "Send a message to start the conversation");
  const { data: threadHistory, isLoading, isFetching } = useThreadHistory(threadId);
  const entries = useMemo(
    () => (threadHistory ? messagesFromTurns(threadHistory.turns) : []),
    [threadHistory],
  );
  const streamingTurn = useChatStore((s) => s.streamingTurn);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const pendingUserMessage = useChatStore((s) => s.pendingUserMessage);
  const pendingUserAttachments = useChatStore((s) => s.pendingUserAttachments);
  const error = useChatStore((s) => s.error);
  const scrollRef = useRef<HTMLDivElement>(null);
  const deferredParentContent = useDeferredValue(streamingTurn?.parentContent ?? "");
  const deferredParentThinking = useDeferredValue(streamingTurn?.parentThinking ?? "");
  const streamingSubagents = useMemo(
    () => (streamingTurn ? buildStreamingSubagents(streamingTurn.events) : []),
    [streamingTurn],
  );
  const parentTools = useMemo(
    () =>
      streamingTurn
        ? streamingParentTools(streamingTurn.events)
        : { toolCalls: [], toolResults: [] },
    [streamingTurn],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // While streaming (or with a pending user bubble) the scroll ALWAYS
    // follows the latest content — the composer is the focus, reading older
    // messages is not the current intent. Otherwise the smart rule applies:
    // follow only when the user already sits near the bottom.
    if (isStreaming || pendingUserMessage !== null) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
      return;
    }
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [
    entries,
    streamingTurn,
    pendingUserMessage,
    error,
    isStreaming,
    deferredParentContent,
    deferredParentThinking,
  ]);

  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center gap-2 bg-bg p-6"
        aria-busy="true"
        aria-live="polite"
      >
        <span
          className="spin inline-block h-4 w-4 border-2 border-accent border-t-transparent"
          aria-hidden="true"
        />
        <span className="font-mono text-xs text-muted">Loading messages…</span>
      </div>
    );
  }

  const hasMessages = entries.length > 0;
  const threadSource = threadHistory?.thread?.source;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      {threadSource && (
        <div
          data-od-id="thread-header"
          className="flex shrink-0 items-center gap-2 border-b border-border-soft px-4 py-2 md:px-6"
        >
          <ThreadSourceBadge source={threadSource} />
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Thread</span>
        </div>
      )}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-5 overflow-y-auto bg-bg p-4 md:p-6">
        {hasMessages &&
          entries.map((entry, idx) => {
            const key = `${entry.message.timestamp}-${idx}`;
            const isLastAi = idx === entries.length - 1 && entry.message.role === MessageRole.AI;
            return (
              <ChatMessage
                key={key}
                message={entry.message}
                agentName={agentName}
                threadId={threadId}
                events={entry.events}
                isLast={isLastAi}
                expandThinking={isLastAi}
              />
            );
          })}

        {!hasMessages && !isStreaming && !error && !pendingUserMessage && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4"
            data-od-id="chat-empty-state"
          >
            <MessagesSquare className="h-12 w-12 text-muted" aria-hidden="true" />
            <p className="font-body text-sm text-muted">{resolvedEmptyMessage}</p>
          </div>
        )}

        {pendingUserMessage !== null && (
          <ChatMessage
            message={{
              role: MessageRole.HUMAN,
              content: pendingUserMessage,
              timestamp: new Date().toISOString(),
              tool_calls: null,
              status: null,
              structured_response: null,
              thinking: null,
              turn_id: null,
              // REQ-069: the optimistic pending message keeps its attachments
              // until the history reloads and the trace projection takes over.
              attachments: pendingUserAttachments,
            }}
            agentName={agentName}
            threadId={threadId}
          />
        )}

        {/* The streamed turn STAYS rendered while the history refetch is in
            flight after the stream completes: dropping it on isStreaming=false
            alone made the message disappear for one frame (history swap) —
            the flicker. It unmounts only once the refetch resolves. */}
        {(isStreaming || isFetching) && streamingTurn && (
          <div className="animate-chat-msg-enter flex gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-accent font-display text-xs uppercase text-accent-on"
              aria-hidden="true"
            >
              {agentName.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-fg">{agentName}</span>
              </div>
              <div className="border border-border bg-surface flex flex-col gap-3 p-4 text-sm text-fg">
                {/* Streaming reasoning FIRST (open — the thoughts stream
                    progressively; the only place the user can WATCH the
                    model think), then the partial answer below it. */}
                {deferredParentThinking && (
                  <ThinkingBlock text={deferredParentThinking} source={null} defaultExpanded />
                )}

                {deferredParentContent && (
                  <div className={MARKDOWN_PROSE_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {deferredParentContent}
                    </ReactMarkdown>
                  </div>
                )}

                {parentTools.toolCalls.map((call) => (
                  <ToolCallBadge
                    key={call.id}
                    name={call.name ?? "unknown"}
                    args={call.content}
                    source={null}
                  />
                ))}
                {parentTools.toolResults.map((result) => (
                  <ToolResultBlock
                    key={result.id}
                    name={result.name}
                    content={result.content}
                    source={null}
                  />
                ))}

                {streamingSubagents.map((sub) => (
                  <SubagentPanel
                    key={sub.name}
                    name={sub.name}
                    content={sub.content}
                    thinking={sub.thinking}
                    toolCalls={sub.toolCalls}
                    toolResults={sub.toolResults}
                  />
                ))}

                <StructuredResponseLive
                  result={streamingTurn.structured_response}
                  hasResponseFormat={agentHasResponseFormat}
                />

                <div
                  className="mt-2 flex items-center gap-2 font-mono text-xs text-muted"
                  aria-live="polite"
                >
                  <span
                    className="spin inline-block h-3 w-3 border-2 border-accent border-t-transparent"
                    aria-hidden="true"
                  />
                  <span>{streamingTurn.parentContent ? "Processing…" : "Thinking…"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && !isStreaming && <ChatErrorPanel agentName={agentName} error={error} />}
      </div>
    </div>
  );
}
