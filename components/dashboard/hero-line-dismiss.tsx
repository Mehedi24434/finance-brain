"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "fb.hero.dismissed";

export default function HeroLineDismiss({
  open,
  urgent,
  aging,
}: {
  open: number;
  urgent: number;
  aging: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined") {
        setDismissed(window.localStorage.getItem(KEY) === "1");
      }
    } catch {
      // localStorage unavailable in private mode — keep visible.
    }
  }, []);

  if (!mounted || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
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
