"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col bg-navy-950 px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+48px)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex flex-col items-center">
          <Logo tone="onDark" className="h-40 w-auto" />
          <div className="mt-6 h-px w-40 bg-white/25" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Lead Tracker</p>
        </div>

        <form onSubmit={submit} className="mt-12 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-label text-white/60">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 w-full rounded-md border-2 border-white/15 bg-white/5 px-4 text-base text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-label text-white/60">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 w-full rounded-md border-2 border-white/15 bg-white/5 px-4 text-base text-white focus:border-white/60 focus:outline-none"
            />
          </label>
          {error && <p className="rounded-md bg-red-600/20 p-3 text-sm font-semibold text-red-200">{error}</p>}
          <button
            disabled={loading}
            className="h-14 w-full rounded-md bg-white text-base font-bold uppercase tracking-wider text-navy-950 active:bg-navy-100 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-auto pt-10 text-center text-[11px] uppercase tracking-[0.25em] text-white/35">AJSJ Services LLC</p>
      </div>
    </main>
  );
}
