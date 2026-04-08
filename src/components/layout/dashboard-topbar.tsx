"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";

interface DashboardTopbarProps {
  user: User;
}

export function DashboardTopbar({ user }: DashboardTopbarProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-[#222738] bg-[#13161f] flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#8b90a0]">{user.email}</span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  );
}
