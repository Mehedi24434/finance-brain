"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import QuickCapture from "./quick-capture";

// The date depends on the user's local timezone — must be a client-side
// value, but rendering it during render would cause hydration mismatch
// (server is UTC, client is local). useSyncExternalStore is React's
// documented escape hatch: it returns getServerSnapshot during SSR and
// getSnapshot on the client, with no hydration warning and no
// set-state-in-effect rule violation.
const noopSubscribe = () => () => {};
const getTodayClient = () => format(new Date(), "EEEE, MMM d");
const getTodayServer = () => "";

export default function TopBar() {
  const today = useSyncExternalStore(
    noopSubscribe,
    getTodayClient,
    getTodayServer,
  );

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
