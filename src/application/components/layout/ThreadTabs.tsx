import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/application/lib/utils";
import { useThreads } from "@/application/hooks/chat/useThreads";
import { useAgents } from "@/application/hooks/agent/useAgents";
import { useCreateThread } from "@/application/hooks/chat/useCreateThread";
import { useChatStore } from "@/application/stores/useChatStore";
import {
  isBuiltinAgent,
  sortAgentsBuiltinFirst,
} from "@/domain/entities/agent/agentConfigMetadata";
import { badgeVariants } from "@/application/components/ui/badge-variants";
import { Button } from "@/application/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/application/components/ui/tabs";
import ThreadSourceBadge from "@/application/components/shared/ThreadSourceBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
import type { Thread } from "@/domain/entities/chat/thread";

function threadLabel(thread: Thread): string {
  return `Thread · ${thread.id.slice(0, 8)}`;
}

/**
 * Conversation threads as tabs in the main header — replaces the previous
 * threads sidebar list (unusable on phones): one scrollable tab strip plus
 * a compact "+" trigger opening the existing agent chooser.
 */
export default function ThreadTabs() {
  const { data: threads, isLoading } = useThreads();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const createThread = useCreateThread();
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeThreadId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : undefined;
  const [chooserOpen, setChooserOpen] = useState(false);
  // Chooser ordering is a UI concern (spec §REQ-045): built-in assistant
  // before custom agents, backend order preserved within each group.
  const sortedAgents = useMemo(() => sortAgentsBuiltinFirst(agents ?? []), [agents]);

  function handleSelectThread(threadId: string) {
    setActiveThread(threadId);
    navigate(`/chat/${threadId}`);
  }

  function handleSelectAgent(agentName: string) {
    createThread.mutate(agentName, {
      onSuccess: (thread) => {
        setActiveThread(thread.id);
        navigate(`/chat/${thread.id}`);
        setChooserOpen(false);
      },
      onError: () => setChooserOpen(false),
    });
  }

  return (
    <div
      data-od-id="thread-tabs"
      className="flex min-w-0 flex-1 items-center gap-2"
      aria-label="Conversation threads"
    >
      <Tabs
        value={activeThreadId ?? ""}
        onValueChange={handleSelectThread}
        className="min-w-0 flex-1"
      >
        <TabsList
          className="max-w-full justify-start overflow-x-auto overscroll-x-contain whitespace-nowrap"
          aria-busy={isLoading}
        >
          {isLoading && (
            <TabsTrigger value="" disabled data-testid="thread-tabs-loading">
              …
            </TabsTrigger>
          )}
          {threads?.map((thread) => (
            <TabsTrigger key={thread.id} value={thread.id} className="max-w-[180px] gap-2">
              <span className="truncate">{threadLabel(thread)}</span>
              <ThreadSourceBadge source={thread.source} />
            </TabsTrigger>
          ))}
          {!isLoading && (!threads || threads.length === 0) && (
            <span
              data-testid="thread-tabs-empty"
              className="flex items-center px-3 font-mono text-xs text-muted"
            >
              No conversations yet
            </span>
          )}
        </TabsList>
      </Tabs>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn("h-8 w-8 shrink-0", "text-sm")}
        aria-label="New conversation"
        data-od-id="thread-tabs-new"
        onClick={() => setChooserOpen(true)}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Dialog open={chooserOpen} onOpenChange={(v) => setChooserOpen(v)}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="font-display text-base uppercase tracking-[0.06em]">
              Choose an Agent
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select an agent to start a new conversation thread
            </DialogDescription>
          </DialogHeader>
          {agentsLoading ? (
            <p className="font-mono text-xs text-muted" aria-live="polite">
              Loading agents…
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain">
              {agents?.length === 0 && (
                <p className="py-4 text-center font-mono text-xs text-muted">No agents available</p>
              )}
              {sortedAgents.map((agent) => (
                <button
                  key={agent.name}
                  type="button"
                  onClick={() => handleSelectAgent(agent.name)}
                  disabled={createThread.isPending}
                  className="w-full rounded-none border border-border bg-surface-warm p-3 text-left transition-[background-color,border-color,color] duration-fast ease-standard hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="block truncate text-sm font-semibold text-fg">
                      {agent.name}
                    </span>
                    {isBuiltinAgent(agent.name, agent.is_builtin) && (
                      <span
                        data-od-id="agent-chooser-builtin-badge"
                        className={cn(badgeVariants({ variant: "accent" }), "shrink-0")}
                      >
                        built-in
                      </span>
                    )}
                  </span>
                  <span className="block font-mono text-xs text-muted">{agent.model}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
