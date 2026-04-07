"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pause,
  Play,
  Share2,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DebateMessage from "./DebateMessage";
import DebateStatus from "./DebateStatus";
import { useDebateManagerStore } from "@/stores/debateManager";
import { getDebate } from "@/lib/api";
import type { Debate, AgentConfig, DebateMessage as DebateMessageType } from "@/types";

interface DebateViewProps {
  debateId: string;
}

export default function DebateView({ debateId }: DebateViewProps) {
  const router = useRouter();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // DebateManager state
  const activeDebate = useDebateManagerStore(
    (state) => state.activeDebates[debateId],
  );
  const startDebate = useDebateManagerStore((state) => state.startDebate);
  const resumeDebate = useDebateManagerStore((state) => state.resumeDebate);
  const pauseDebate = useDebateManagerStore((state) => state.pauseDebate);

  // Load debate from API once to get full config (agent configs, topic, etc.)
  // Then auto-start if status is 'created' and not already active.
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (debate) {
      // Already loaded — just check if we need to auto-start
      if (!hasStartedRef.current && debate.status === "created" && !activeDebate) {
        hasStartedRef.current = true;
        startDebate(debate.id, debate.max_turns);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadDebate() {
      try {
        const data = await getDebate(debateId);
        if (cancelled) return;
        setDebate(data);
      } catch (err) {
        if (cancelled) return;
        setFetchError(
          err instanceof Error ? err.message : "Failed to load debate",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDebate();
    return () => {
      cancelled = true;
    };
  }, [debateId, debate, activeDebate, startDebate]);

  // Determine data source: prefer DebateManager over API-loaded debate
  const status = activeDebate?.status ?? debate?.status ?? "created";
  const currentTurn = activeDebate?.currentTurn ?? debate?.current_turn ?? 0;
  const maxTurns = activeDebate?.maxTurns ?? debate?.max_turns ?? 0;
  const topic = debate?.topic ?? "";
  const agentAConfig: AgentConfig = debate?.agent_a_config ?? {
    name: "Agent A",
    personality: "",
    provider: "openai",
    model: "",
  };
  const agentBConfig: AgentConfig = debate?.agent_b_config ?? {
    name: "Agent B",
    personality: "",
    provider: "anthropic",
    model: "",
  };

  // Build message list from either source
  const messages: DebateMessageType[] = activeDebate
    ? activeDebate.messages
    : (debate?.turns ?? []).map((t) => ({
        turnNumber: t.turn_number,
        agentName: t.agent_name,
        agentSide: t.agent_side,
        content: t.content,
        isStreaming: false,
      }));

  const error = activeDebate?.error;

  // Auto-scroll: track whether user has scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    shouldAutoScroll.current = atBottom;
  }, []);

  // Auto-scroll to bottom when new messages/tokens arrive
  useEffect(() => {
    if (shouldAutoScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handlers
  const handlePause = useCallback(() => {
    pauseDebate(debateId);
  }, [pauseDebate, debateId]);

  const handleResume = useCallback(() => {
    const completedMessages = (activeDebate?.messages ?? []).filter(
      (m) => !m.isStreaming,
    );
    const turnsFromMessages: import("@/types").Turn[] = completedMessages.map((m) => ({
      turn_number: m.turnNumber,
      agent_name: m.agentName,
      agent_side: m.agentSide,
      content: m.content,
      model_used: "",
      created_at: "",
    }));
    const turns = turnsFromMessages.length > 0 ? turnsFromMessages : (debate?.turns ?? []);
    const max = activeDebate?.maxTurns ?? debate?.max_turns ?? 0;
    resumeDebate(debateId, turns, max);
  }, [resumeDebate, debateId, debate, activeDebate]);

  const handleRestart = useCallback(() => {
    if (!debate) return;
    router.push(`/new?from=${debate.id}`);
  }, [debate, router]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/shared/${debateId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing if clipboard not available
    }
  }, [debateId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Fetch error state
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{fetchError}</p>
      </div>
    );
  }

  const getAgentConfig = (side: "a" | "b"): AgentConfig =>
    side === "a" ? agentAConfig : agentBConfig;

  return (
    <div className="flex flex-col h-full">
      {/* Header: DebateStatus */}
      <div className="shrink-0 p-4 pb-0">
        <DebateStatus
          topic={topic}
          status={
            status === "error" ? "paused" : (status as "created" | "running" | "paused" | "completed")
          }
          currentTurn={currentTurn}
          maxTurns={maxTurns}
          agentAConfig={agentAConfig}
          agentBConfig={agentBConfig}
        />
      </div>

      {/* Action buttons */}
      <div className="shrink-0 px-4 pt-3 flex items-center gap-2">
        {status === "running" && (
          <Button variant="outline" size="sm" onClick={handlePause}>
            <Pause className="h-4 w-4 mr-1" />
            Pause
          </Button>
        )}
        {debate && (
          <Button variant="outline" size="sm" onClick={handleRestart}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Restart
          </Button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && status === "running" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">
              Waiting for first turn...
            </span>
          </div>
        )}

        {messages.map((msg) => (
          <DebateMessage
            key={`${msg.agentSide}-${msg.turnNumber}`}
            message={msg}
            agentConfig={getAgentConfig(msg.agentSide)}
            turnNumber={msg.turnNumber}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Footer: conditional based on state */}
      <Footer
        status={status}
        error={error}
        copied={copied}
        onResume={handleResume}
        onShare={handleShare}
      />
    </div>
  );
}

interface FooterProps {
  status: string;
  error?: { code: string; message: string; recoverable: boolean };
  copied: boolean;
  onResume: () => void;
  onShare: () => void;
}

function Footer({ status, error, copied, onResume, onShare }: FooterProps) {
  if (status === "error" && error) {
    return (
      <div className="shrink-0 border-t bg-destructive/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error.message}</p>
          {error.recoverable ? (
            <Button variant="outline" size="sm" onClick={onResume}>
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              This debate cannot continue
            </span>
          )}
        </div>
      </div>
    );
  }

  if (status === "paused") {
    return (
      <div className="shrink-0 border-t bg-yellow-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-yellow-700">
            This debate is paused.
          </span>
          <Button variant="outline" size="sm" onClick={onResume}>
            <Play className="h-4 w-4 mr-1" />
            Resume
          </Button>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="shrink-0 border-t bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-700">Debate completed!</span>
          <TooltipProvider>
            <Tooltip open={copied || undefined}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onShare}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-1" />
                  )}
                  {copied ? "Copied!" : "Share"}
                </Button>
              </TooltipTrigger>
              {copied && (
                <TooltipContent>
                  <p>Link copied to clipboard!</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  return null;
}
