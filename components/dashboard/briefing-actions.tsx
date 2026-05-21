"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GenerateBriefingButton({
  label = "Generate today's briefing",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function generate() {
    if (busy || pending) return;
    setBusy(true);
    start(async () => {
      const toastId = toast.loading("Generating briefing…");
      try {
        const res = await fetch("/api/briefing", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success("Briefing generated", { id: toastId });
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Briefing generation failed",
          { id: toastId },
        );
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={busy || pending} onClick={generate}>
      <Sparkles className="size-3.5" />
      {busy || pending ? "Generating…" : label}
    </Button>
  );
}

export function RegenerateBriefingIcon() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function regenerate() {
    if (busy || pending) return;
    setBusy(true);
    start(async () => {
      const toastId = toast.loading("Regenerating briefing…");
      try {
        const res = await fetch("/api/briefing", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success("Briefing regenerated", { id: toastId });
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Regeneration failed",
          { id: toastId },
        );
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={regenerate}
      disabled={busy || pending}
      title="Regenerate"
      aria-label="Regenerate briefing"
      className="h-6 w-6 grid place-items-center rounded text-text-secondary hover:text-text-primary hover:bg-hover transition-colors disabled:opacity-40"
    >
      <RefreshCw className={`size-3.5 ${busy || pending ? "animate-spin" : ""}`} />
    </button>
  );
}
