"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

const KEY = "fb.hero.dismissed";
const SAME_TAB_EVENT = "fb.hero.dismissed:changed";

// Read localStorage via useSyncExternalStore so SSR returns "not
// dismissed" (banner visible), the client picks up the real value on
// hydration, and React handles the mismatch without warnings. This
// also eliminates the set-state-in-effect lint violation that the
// previous useEffect-based approach produced.
function subscribe(callback: () => void) {
  // The native `storage` event only fires across tabs, so we also
  // listen for a custom event we dispatch ourselves on same-tab
  // dismiss.
  window.addEventListener("storage", callback);
  window.addEventListener(SAME_TAB_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SAME_TAB_EVENT, callback);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Private-mode browsers throw on localStorage access.
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export default function HeroLineDismiss({
  open,
  urgent,
  aging,
}: {
  open: number;
  urgent: number;
  aging: number;
}) {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    // The `storage` event doesn't fire for same-tab writes, so prod
    // a custom one to trigger useSyncExternalStore to re-evaluate.
    window.dispatchEvent(new Event(SAME_TAB_EVENT));
  }

  return (
    <div className="bg-raised/40 border border-border rounded-md px-3 py-2 flex items-center gap-3 font-mono text-[12px] text-text-secondary">
      <span className="text-text-primary font-semibold tracking-tight">
        Finance Brain
      </span>
      <span className="text-text-tertiary">— operational memory.</span>
      <span>
        <span className="text-text-primary">{open}</span> open
      </span>
      <span className="text-text-tertiary">·</span>
      <span>
        <span className={urgent > 0 ? "text-urgent" : "text-text-primary"}>
          {urgent}
        </span>{" "}
        urgent
      </span>
      <span className="text-text-tertiary">·</span>
      <span>
        <span className={aging > 0 ? "text-warning" : "text-text-primary"}>
          {aging}
        </span>{" "}
        aging followups
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-auto h-5 w-5 grid place-items-center rounded text-text-tertiary hover:text-text-primary hover:bg-hover transition-colors"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
