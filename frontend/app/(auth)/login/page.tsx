"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Swords, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";

export default function LoginPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (session?.user && !isPending) {
    router.replace("/new");
    return null;
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isRegister) {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: name || username,
        username,
      });

      if (error) {
        setError(error.message || "Registration failed");
        setLoading(false);
        return;
      }

      router.replace("/new");
    } else {
      // Try username sign-in first, fall back to email
      const isEmail = login.includes("@");

      if (isEmail) {
        const { error } = await authClient.signIn.email({
          email: login,
          password,
        });
        if (error) {
          setError("Invalid email or password");
          setLoading(false);
          return;
        }
      } else {
        const { error } = await authClient.signIn.username({
          username: login,
          password,
        });
        if (error) {
          setError("Invalid username or password");
          setLoading(false);
          return;
        }
      }

      router.replace("/new");
    }
    setLoading(false);
  };

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
            {isRegister ? "Create an account" : "Welcome back"}
          </h1>
          <p className="mb-6 text-center text-sm text-slate-400">
            {isRegister ? "Sign up to start debating" : "Sign in to start debating"}
          </p>

          {/* Discord OAuth */}
          <Button
            onClick={() =>
              authClient.signIn.social({
                provider: "discord",
                callbackURL: "/new",
              })
            }
            variant="outline"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Continue with Discord
          </Button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-700" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-700" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
            {isRegister && (
              <>
                <div>
                  <Label htmlFor="username" className="mb-1.5 block text-sm text-slate-300">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="cooluser42"
                    required
                    minLength={3}
                    className="border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="mb-1.5 block text-sm text-slate-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label htmlFor="name" className="mb-1.5 block text-sm text-slate-300">
                    Display Name <span className="text-slate-500">(optional)</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
              </>
            )}

            {!isRegister && (
              <div>
                <Label htmlFor="login" className="mb-1.5 block text-sm text-slate-300">
                  Username or Email
                </Label>
                <Input
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                />
              </div>
            )}

            <div>
              <Label htmlFor="password" className="mb-1.5 block text-sm text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRegister ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Toggle sign in / register */}
          <p className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="font-medium text-blue-400 transition-colors hover:text-blue-300"
            >
              {isRegister ? "Sign in" : "Create one"}
            </button>
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
