"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import QuickCapture from "./quick-capture";

export default function TopBar() {
  // Computing the date during render would mismatch between server SSR
  // (UTC) and client hydration (user's local TZ) at the day boundary.
  // Defer to a post-mount effect so the first paint is empty and the
  // real value lands on the client only.
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(format(new Date(), "EEEE, MMM d"));
  }, []);

  const env = process.env.NEXT_PUBLIC_ENV ?? "dev";

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface px-4 flex items-center gap-3">
      <div
        className="text-xs text-text-secondary font-mono whitespace-nowrap min-w-[7.5rem]"
        suppressHydrationWarning
      >
        {today}
      </div>
      <span className="inline-flex items-center h-5 px-2 rounded text-[10px] uppercase tracking-wider font-mono bg-raised text-text-secondary border border-border">
        {env}
      </span>
      <div className="flex-1 max-w-xl ml-auto">
        <QuickCapture />
      </div>
      <kbd
        className="hidden md:inline-flex items-center h-6 px-1.5 rounded border border-border bg-raised text-text-tertiary text-[10px] font-mono"
        title="Open command palette"
      >
        ⌘K
      </kbd>
    </header>
  );
}
