"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold tracking-widest text-[#4f7ef5] uppercase">
            PI Report Writer
          </p>
          <h1 className="text-2xl font-bold text-[#e8eaf0]">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-[#8b90a0]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#2a2f42] bg-[#161922] px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#8b90a0] focus:outline-none focus:ring-2 focus:ring-[#4f7ef5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-[#8b90a0]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#2a2f42] bg-[#161922] px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#8b90a0] focus:outline-none focus:ring-2 focus:ring-[#4f7ef5]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#4f7ef5] py-2.5 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-[#8b90a0]">
          No account?{" "}
          <Link href="/signup" className="text-[#4f7ef5] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
