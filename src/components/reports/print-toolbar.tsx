"use client";

import { Printer } from "lucide-react";

export function PrintToolbar() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-[#4f7ef5] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
    >
      <Printer size={14} />
      Print / Export PDF
    </button>
  );
}
