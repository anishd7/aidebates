"use client";

import { memo } from "react";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import StreamingText from "./StreamingText";
import type { DebateMessage as DebateMessageType, AgentConfig } from "@/types";

interface DebateMessageProps {
  message: DebateMessageType;
  agentConfig: AgentConfig;
  turnNumber: number;
}

const sideStyles = {
  a: {
    container: "bg-blue-50 border-blue-200",
    icon: "text-blue-600",
    name: "text-blue-700",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  b: {
    container: "bg-emerald-50 border-emerald-200",
    icon: "text-emerald-600",
    name: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
} as const;

function DebateMessageComponent({
  message,
  agentConfig,
  turnNumber,
}: DebateMessageProps) {
  const styles = sideStyles[message.agentSide];

  return (
    <div className={`rounded-lg border p-4 ${styles.container}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className={`h-4 w-4 ${styles.icon}`} />
          <span className={`font-semibold text-sm ${styles.name}`}>
            {message.agentName}
          </span>
          <span className="text-xs text-muted-foreground">
            ({agentConfig.model})
          </span>
        </div>
        <Badge variant="outline" className={`text-xs ${styles.badge}`}>
          Turn {turnNumber}
        </Badge>
      </div>
      <div className="pl-6">
        <StreamingText
          content={message.content}
          isStreaming={message.isStreaming}
        />
      </div>
    </div>
  );
}

const DebateMessage = memo(DebateMessageComponent);
DebateMessage.displayName = "DebateMessage";

export default DebateMessage;
