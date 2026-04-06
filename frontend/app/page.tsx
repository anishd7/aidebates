import Link from "next/link";
import { Swords, Cpu, Radio, Share2, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "AI Debate Arena — Watch AI Models Debate in Real-Time",
  description:
    "Configure two AI agents, pick a topic, and watch them debate live. Supports GPT-4.1, Claude, and more.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 font-[family-name:var(--font-geist-sans)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
      </nav>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 sm:py-32">
        {/* Background gradient effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        </div>

        {/* VS badge */}
        <div className="relative mb-8 flex items-center gap-3">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-blue-500/60 sm:w-20" />
          <div className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-slate-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            GPT vs Claude
          </div>
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-500/60 sm:w-20" />
        </div>

        <h1 className="relative text-center text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Watch AI Models
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
            Debate in Real-Time
          </span>
        </h1>

        <p className="relative mt-6 max-w-xl text-center text-lg leading-relaxed text-slate-400 sm:text-xl">
          Configure two AI agents, pick a topic, and watch them go head-to-head.
          GPT-4.1 vs Claude? You decide.
        </p>

        <div className="relative mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110"
          >
            <Link href="/login">
              Get Started
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Decorative "arena" visual */}
        <div className="relative mt-20 w-full max-w-2xl">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="flex items-stretch gap-4">
              {/* Agent A */}
              <div className="flex-1 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                  <span className="text-sm font-semibold text-blue-300">
                    Agent Alpha
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-blue-500/15" />
                  <div className="h-2 w-4/5 rounded-full bg-blue-500/15" />
                  <div className="h-2 w-3/5 rounded-full bg-blue-500/15" />
                </div>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  VS
                </div>
              </div>

              {/* Agent B */}
              <div className="flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">
                    Agent Beta
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-emerald-500/15" />
                  <div className="h-2 w-3/4 rounded-full bg-emerald-500/15" />
                  <div className="h-2 w-5/6 rounded-full bg-emerald-500/15" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800/60 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Everything you need to run AI debates
            </h2>
            <p className="mt-3 text-slate-400">
              A full-featured platform for pitting language models against each
              other.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-xl border border-slate-800 bg-slate-900/80 p-6 transition-colors hover:border-blue-500/30 hover:bg-slate-900">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                Multiple Models
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Choose from GPT-4.1, GPT-4o, Claude 3.5 Sonnet, Claude 3 Opus,
                and more. Mix providers in a single debate.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-xl border border-slate-800 bg-slate-900/80 p-6 transition-colors hover:border-emerald-500/30 hover:bg-slate-900">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
                <Radio className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                Real-Time Streaming
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Watch tokens stream in live as each agent crafts its argument.
                Server-sent events deliver every word as it&apos;s generated.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-xl border border-slate-800 bg-slate-900/80 p-6 transition-colors hover:border-amber-500/30 hover:bg-slate-900 sm:col-span-2 lg:col-span-1">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500/20">
                <Share2 className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                Share & Resume
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Pause debates and pick up where you left off. Share completed
                debates with a public link anyone can view.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} AI Debate Arena
          </p>
          <Link
            href="/login"
            className="text-sm text-slate-500 transition-colors hover:text-slate-300"
          >
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  );
}
