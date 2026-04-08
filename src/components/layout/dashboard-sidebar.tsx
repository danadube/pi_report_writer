"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Plus, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: FileText,
    exact: false,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-[#13161f] border-r border-[#222738]">
      <div className="px-5 py-5 border-b border-[#222738]">
        <span className="text-sm font-bold tracking-wide text-[#e8eaf0]">
          PI Report Writer
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              isActive(href, exact)
                ? "bg-[#1e2a4a] text-[#4f7ef5] font-medium"
                : "text-[#8b90a0] hover:bg-[#1e2130] hover:text-[#e8eaf0]"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[#222738]">
        <Link
          href="/dashboard/reports/new"
          className="flex items-center justify-center gap-2 w-full rounded-md bg-[#4f7ef5] px-3 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
        >
          <Plus size={15} />
          New Report
        </Link>
      </div>
    </aside>
  );
}
