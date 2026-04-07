"use client";

import { memo, useState } from "react";
import {
  Circle,
  Pause,
  CheckCircle2,
  Clock,
  Bot,
  ChevronDown,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DebateStatus as DebateStatusType, AgentConfig } from "@/types";

interface DebateStatusProps {
  topic: string;
  status: DebateStatusType;
  currentTurn: number;
  maxTurns: number;
  agentAConfig: AgentConfig;
  agentBConfig: AgentConfig;
}

const statusConfig = {
  created: {
    label: "Created",
    icon: Clock,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    dotClass: "text-gray-500",
  },
  running: {
    label: "Running",
    icon: Circle,
    badgeClass: "bg-green-100 text-green-700 border-green-300",
    dotClass: "text-green-500 animate-pulse",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-300",
    dotClass: "text-yellow-500",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300",
    dotClass: "text-blue-500",
  },
} as const;

interface AgentDetailProps {
  config: AgentConfig;
  colorClass: string;
  iconColorClass: string;
}

function AgentDetail({ config, colorClass, iconColorClass }: AgentDetailProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
      >
        <Bot className={`h-3.5 w-3.5 ${iconColorClass} shrink-0`} />
        <span className={`${colorClass} font-medium`}>{config.name}</span>
        <span className="text-muted-foreground text-xs">({config.model})</span>
        {config.web_search_enabled && (
          <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-5 mt-1.5 text-xs space-y-1 text-muted-foreground border-l-2 border-muted pl-3">
          <div>
            <span className="font-medium text-foreground/70">Provider:</span>{" "}
            {config.provider}
          </div>
          <div>
            <span className="font-medium text-foreground/70">Model:</span>{" "}
            {config.model}
          </div>
          <div>
            <span className="font-medium text-foreground/70">Web search:</span>{" "}
            {config.web_search_enabled ? "Enabled" : "Disabled"}
          </div>
          {config.personality && (
            <div>
              <span className="font-medium text-foreground/70">
                Personality:
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{config.personality}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DebateStatusComponent({
  topic,
  status,
  currentTurn,
  maxTurns,
  agentAConfig,
  agentBConfig,
}: DebateStatusProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Topic */}
      <h2 className="text-lg font-semibold text-foreground leading-snug">
        &ldquo;{topic}&rdquo;
      </h2>

      {/* Status + Turn Counter */}
      <div className="flex items-center gap-3 mt-2">
        <Badge variant="outline" className={config.badgeClass}>
          <StatusIcon className={`h-3 w-3 mr-1 ${config.dotClass}`} />
          {config.label}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Turn {currentTurn}/{maxTurns}
        </span>
      </div>

      <Separator className="my-3" />

      {/* Agent Info */}
      <div className="flex flex-col gap-1.5 text-sm">
        <AgentDetail
          config={agentAConfig}
          colorClass="text-blue-700"
          iconColorClass="text-blue-600"
        />
        <span className="text-xs text-muted-foreground pl-5">vs</span>
        <AgentDetail
          config={agentBConfig}
          colorClass="text-emerald-700"
          iconColorClass="text-emerald-600"
        />
      </div>
    </div>
  );
}

const DebateStatus = memo(DebateStatusComponent);
DebateStatus.displayName = "DebateStatus";

export default DebateStatus;
