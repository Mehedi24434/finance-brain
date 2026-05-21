"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function TriageButton({
  inboxId,
  size = "sm",
  variant = "outline",
  className,
}: {
  inboxId: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function triage(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (busy || pending) return;
    setBusy(true);
    start(async () => {
      const toastId = toast.loading("Triaging…");
      try {
        const res = await fetch(`/api/inbox/${inboxId}/triage`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success("Triaged", { id: toastId });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Triage failed", {
          id: toastId,
        });
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={triage}
      disabled={busy || pending}
      className={cn(className)}
    >
      <Sparkles className="size-3" />
      {busy || pending ? "Triaging…" : "Triage"}
    </Button>
  );
}
