"use client";

import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Swords, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/new");
    }
  }, [status, router]);

  // Show a loading spinner while checking auth status
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  // If authenticated, show nothing while redirecting
  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
            <Swords className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            AI Debate Arena
          </span>
        </Link>

        {/* Card */}
        <div className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur-sm">
          <h1 className="mb-2 text-center text-2xl font-bold text-white">
            Welcome back
          </h1>
          <p className="mb-8 text-center text-sm text-slate-400">
            Sign in to start debating
          </p>

          <Button
            onClick={() => signIn("google", { callbackUrl: "/new" })}
            variant="outline"
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>

          <p className="mt-6 text-center text-xs text-slate-500">
            By signing in, you agree to our terms of service.
          </p>
        </div>

        {/* Back to home link */}
        <Link
          href="/"
          className="mt-6 text-sm text-slate-500 transition-colors hover:text-slate-300"
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
