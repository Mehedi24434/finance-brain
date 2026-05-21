"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function MeetingBriefSheet({
  meetingId,
  meetingTitle,
  initialPreBrief,
}: {
  meetingId: string;
  meetingTitle: string;
  initialPreBrief: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [preBrief, setPreBrief] = useState<string | null>(initialPreBrief);
  const [busy, setBusy] = useState(false);

  function generate() {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading("Generating pre-brief…");
    start(async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/prebrief`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        const data = (await res.json()) as { pre_brief: string };
        setPreBrief(data.pre_brief);
        toast.success("Pre-brief ready", { id: toastId });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed", {
          id: toastId,
        });
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            title={preBrief ? "View pre-brief" : "Generate pre-brief"}
          >
            <Sparkles className="size-3" />
            {preBrief ? "Brief" : "Brief me"}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{meetingTitle}</SheetTitle>
          <SheetDescription>Pre-meeting brief</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-3 overflow-y-auto">
          {preBrief ? (
            <div className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap">
              {preBrief}
            </div>
          ) : (
            <div className="text-text-tertiary text-xs">
              No pre-brief yet. Generate one to see Claude&rsquo;s read on who
              will be in the room, what they likely want, and the open items
              worth raising.
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={busy || pending}
          >
            <RefreshCw
              className={cn(
                "size-3",
                (busy || pending) && "animate-spin",
              )}
            />
            {preBrief ? "Regenerate" : "Generate brief"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
