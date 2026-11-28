import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import AppShell from "@/application/components/layout/AppShell";
import MessageList from "@/application/components/chat/MessageList";
import ChatInput from "@/application/components/chat/ChatInput";
import { useChatStore } from "@/application/stores/useChatStore";
import { useThreads } from "@/application/hooks/chat/useThreads";
import { useAgentConfig } from "@/application/hooks/agent/useAgentConfig";
export default function ChatPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const clearStream = useChatStore((s) => s.clearStream);
  const { data: threads } = useThreads();

  useEffect(() => {
    setActiveThread(threadId ?? null);
    clearStream();
  }, [threadId, setActiveThread, clearStream]);

  const agentName = useMemo(() => {
    if (!threadId || !threads) return "Agent";
    const thread = threads.find((t) => t.id === threadId);
    return thread?.agent_name ?? "Agent";
  }, [threadId, threads]);

  const { data: agentConfig } = useAgentConfig(agentName !== "Agent" ? agentName : null);
  const agentHasResponseFormat = useMemo(
    () => !!agentConfig?.response_format && Object.keys(agentConfig.response_format).length > 0,
    [agentConfig],
  );

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {threadId ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <MessageList
              threadId={threadId}
              agentName={agentName}
              agentHasResponseFormat={agentHasResponseFormat}
            />
            <ChatInput threadId={threadId} agentConfig={agentConfig} />
          </div>
        ) : (
          <div
            className="flex flex-1 items-center justify-center p-6"
            data-od-id="chat-empty-state"
          >
            <p className="max-w-sm text-center font-body text-sm text-muted">
              Start a new conversation with the + button in the header to begin orchestrating your
              agents, or switch to an existing thread from the tabs.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
