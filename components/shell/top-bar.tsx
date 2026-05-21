"use client";

import { format } from "date-fns";
import QuickCapture from "./quick-capture";

export default function TopBar() {
  const today = format(new Date(), "EEEE, MMM d");
  const env = process.env.NEXT_PUBLIC_ENV ?? "dev";

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface px-4 flex items-center gap-3">
      <div className="text-xs text-text-secondary font-mono whitespace-nowrap">
        {today}
      </div>
      <span className="inline-flex items-center h-5 px-2 rounded text-[10px] uppercase tracking-wider font-mono bg-raised text-text-secondary border border-border">
        {env}
      </span>
      <div className="flex-1 max-w-xl ml-auto">
        <QuickCapture />
      </div>
    </header>
  );
}
