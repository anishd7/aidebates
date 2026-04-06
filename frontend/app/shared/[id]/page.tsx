import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Swords, Bot, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import DebateMessage from "@/components/debate/DebateMessage";
import type { Debate, DebateMessage as DebateMessageType } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const fetchSharedDebate = cache(async (id: string): Promise<Debate | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/v1/debates/${id}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    const debate = (await response.json()) as Debate;
    if (debate.status !== "completed") return null;
    return debate;
  } catch {
    return null;
  }
});

// ─── SEO Metadata ──────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const debate = await fetchSharedDebate(params.id);
  if (!debate) {
    return { title: "Debate Not Found | AI Debate Arena" };
  }
  return {
    title: `AI Debate: ${debate.topic} | AI Debate Arena`,
    description: `Watch two AI agents debate: "${debate.topic}" — ${debate.agent_a_config.name} vs ${debate.agent_b_config.name}`,
    openGraph: {
      title: `AI Debate: ${debate.topic}`,
      description: `${debate.agent_a_config.name} vs ${debate.agent_b_config.name} — ${debate.max_turns} turns`,
      type: "article",
    },
  };
}

// ─── Page Component ────────────────────────────────────────────────────────

export default async function SharedDebatePage({ params }: PageProps) {
  const debate = await fetchSharedDebate(params.id);

  if (!debate) {
    return <NotFoundView />;
  }

  const messages: DebateMessageType[] = debate.turns.map((turn) => ({
    turnNumber: turn.turn_number,
    agentName: turn.agent_name,
    agentSide: turn.agent_side,
    content: turn.content,
    isStreaming: false,
  }));

  const completedDate = new Date(debate.updated_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              AI Debate Arena
            </span>
          </Link>
          <Button
            asChild
            variant="outline"
            className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-8">
        {/* Debate Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl leading-snug">
            &ldquo;{debate.topic}&rdquo;
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3 text-sm text-slate-400">
            <span>{debate.max_turns} turns</span>
            <span className="text-slate-600">&middot;</span>
            <span>Completed {completedDate}</span>
            <span className="text-slate-600">&middot;</span>
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-300 border-blue-500/30"
            >
              Completed
            </Badge>
          </div>

          {/* Agent Matchup */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-blue-400" />
              <span className="font-medium text-blue-300">
                {debate.agent_a_config.name}
              </span>
              <span className="text-slate-500">
                ({debate.agent_a_config.model})
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              vs
            </span>
            <div className="flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-emerald-400" />
              <span className="font-medium text-emerald-300">
                {debate.agent_b_config.name}
              </span>
              <span className="text-slate-500">
                ({debate.agent_b_config.model})
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-800 mb-8" />

        {/* Debate Messages */}
        <div className="space-y-4">
          {messages.map((message) => (
            <DebateMessage
              key={message.turnNumber}
              message={message}
              agentConfig={
                message.agentSide === "a"
                  ? debate.agent_a_config
                  : debate.agent_b_config
              }
              turnNumber={message.turnNumber}
            />
          ))}
        </div>

        {/* CTA Footer */}
        <Separator className="bg-slate-800 my-8" />
        <div className="text-center pb-12">
          <p className="text-sm text-slate-500 mb-4">
            Shared from AI Debate Arena
          </p>
          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110"
          >
            <Link href="/">
              Create your own debate
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} AI Debate Arena
          </p>
          <Link
            href="/"
            className="text-sm text-slate-500 transition-colors hover:text-slate-300"
          >
            Home
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ─── 404 View ──────────────────────────────────────────────────────────────

function NotFoundView() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 mb-6">
        <Swords className="h-8 w-8 text-slate-500" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Debate Not Found</h1>
      <p className="text-slate-400 text-center max-w-md mb-8">
        This debate doesn&apos;t exist or isn&apos;t available for sharing yet.
        Only completed debates can be viewed publicly.
      </p>
      <Button
        asChild
        className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110"
      >
        <Link href="/">
          Go to AI Debate Arena
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
