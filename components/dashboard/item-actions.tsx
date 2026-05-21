"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Send, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Variant = "task" | "followup";

export default function ItemActions({
  id,
  variant,
  showOpen = true,
}: {
  id: string;
  variant: Variant;
  showOpen?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<Response>) {
    if (pending || busyKey) return;
    setBusyKey(key);
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        const verb =
          key === "resolve"
            ? "Resolved"
            : key === "snooze"
              ? "Snoozed"
              : "Nudged";
        toast.success(verb);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusyKey(null);
      }
    });
  }

  const resolve = () =>
    run("resolve", () => fetch(`/api/tasks/${id}/resolve`, { method: "POST" }));

  const snooze = () => {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return run("snooze", () =>
      fetch(`/api/tasks/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until }),
      }),
    );
  };

  const nudge = () =>
    run("nudge", () => fetch(`/api/followups/${id}/nudge`, { method: "POST" }));

  function open(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/tasks/${id}`);
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {variant === "task" && (
        <>
          <ActionBtn
            label="Resolve"
            icon={<Check className="size-3" />}
            onClick={resolve}
            disabled={!!busyKey}
            tone="ok"
          />
          <ActionBtn
            label="Snooze"
            icon={<Clock className="size-3" />}
            onClick={snooze}
            disabled={!!busyKey}
          />
        </>
      )}
      {variant === "followup" && (
        <ActionBtn
          label="Nudge"
          icon={<Send className="size-3" />}
          onClick={nudge}
          disabled={!!busyKey}
        />
      )}
      {showOpen && variant === "task" && (
        <ActionBtn
          label="Open"
          icon={<ChevronRight className="size-3" />}
          onClick={open}
        />
      )}
    </div>
  );
}

function ActionBtn({
  label,
  icon,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  tone?: "ok";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "h-6 w-6 grid place-items-center rounded text-text-secondary hover:text-text-primary hover:bg-hover transition-colors disabled:opacity-40 disabled:pointer-events-none",
        tone === "ok" && "hover:text-ok hover:bg-ok/10",
      )}
    >
      {icon}
    </button>
  );
}
