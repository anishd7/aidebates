"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { listDebates } from "@/lib/api";
import { useDebateManagerStore } from "@/stores/debateManager";
import type { DebateListItem, DebateStatus } from "@/types";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

function truncateTopic(topic: string, maxLen = 40): string {
  if (topic.length <= maxLen) return topic;
  return topic.slice(0, maxLen).trimEnd() + "...";
}

function StatusIndicator({ status, debateId }: { status: DebateStatus; debateId: string }) {
  const activeDebate = useDebateManagerStore((s) => s.getDebate(debateId));
  const isActivelyRunning = activeDebate?.status === "running";

  // If the debate is actively running in the client, show pulsing regardless of API status
  if (isActivelyRunning || status === "running") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
    );
  }

  if (status === "paused") {
    return <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500" />;
  }

  if (status === "completed") {
    return <Check className="h-3 w-3 text-slate-400" />;
  }

  // created
  return <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />;
}

function DebateList({
  debates,
  pathname,
  onNavigate,
}: {
  debates: DebateListItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-2">
      {debates.map((debate) => {
        const isActive = pathname === `/debate/${debate.id}`;
        return (
          <Link
            key={debate.id}
            href={`/debate/${debate.id}`}
            onClick={onNavigate}
            className={cn(
              "flex flex-col gap-1 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <div className="flex items-center gap-2">
              <StatusIndicator status={debate.status} debateId={debate.id} />
              <span className="truncate font-medium">
                {truncateTopic(debate.topic)}
              </span>
            </div>
            <span className="truncate pl-4 text-xs text-slate-400">
              {debate.agent_a_name} vs {debate.agent_b_name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SidebarContent({
  debates,
  pathname,
  onNavigate,
}: {
  debates: DebateListItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button asChild className="w-full justify-start gap-2" variant="outline">
          <Link href="/new" onClick={onNavigate}>
            <Plus className="h-4 w-4" />
            New Debate
          </Link>
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="py-2">
          {debates.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              No debates yet
            </p>
          ) : (
            <DebateList
              debates={debates}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [debates, setDebates] = useState<DebateListItem[]>([]);
  const pathname = usePathname();

  const fetchDebates = useCallback(async () => {
    try {
      const response = await listDebates({ limit: 50 });
      setDebates(response.debates);
    } catch {
      // Silently fail — sidebar is non-critical
    }
  }, []);

  useEffect(() => {
    fetchDebates();
  }, [fetchDebates]);

  // Refetch when navigating (e.g. after creating a new debate)
  useEffect(() => {
    fetchDebates();
  }, [pathname, fetchDebates]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <SidebarContent debates={debates} pathname={pathname} />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            debates={debates}
            pathname={pathname}
            onNavigate={onClose}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
